#!/usr/bin/env python3
"""Restore an existing synthetic FourBubbles dump in an isolated disposable DB.

Run on the VPS from this repository:
  python3 scripts/vps/validate-fourbubbles-backup.py --backupfile \
    /var/backups/scalaris/fourbubbles/fourbubbles-YYYYMMDDTHHMMSSZ.dump

Only a cached PostgreSQL 16 image, one private read-only dump bind, and a new
memory-backed container are used. No application services or existing DB volumes
are started, mounted, stopped, or changed. --self-test needs neither Docker nor
the VPS and checks guards, not the restorability of an actual backup.
"""
import argparse
import copy
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import time
import uuid

IMAGE = "postgres:16-alpine"
LABEL = "io.scalaris.fourbubbles-restore-probe"
BACKUP_ROOT = Path("/var/backups/scalaris/fourbubbles")
DATABASE = "fourbubbles_demo"
DB_USER = "fourbubbles_demo"
DATA_PATH = "/var/lib/postgresql/data"
DUMP_PATH = "/restore/database.dump"
MEMORY = 512 * 1024 * 1024
MAX_DUMP_SIZE = 64 * 1024 * 1024
LOCAL_ENDPOINTS = {"unix:///var/run/docker.sock", "unix:///run/docker.sock"}
MIGRATION_SCRIPTS = [
    "V1__identity_and_audit.sql", "V2__locations_and_clients.sql",
    "V3__catalog_and_pricing.sql", "V4__orders_and_payments.sql",
    "V5__initial_configuration.sql", "V6__administrative_closure.sql",
    "V7__order_reception.sql", "V8__compatibility_engine.sql",
    "V9__production_cycles.sql", "V10__protect_used_production_programs.sql",
    "V11__production_separation_tracking.sql",
]


def fail(message):
    raise RuntimeError(message)


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def check_backup(path, allowed_root=BACKUP_ROOT, private=True):
    """The caller may only select one canonical private dump in the fixed folder."""
    path = Path(path)
    if (not path.is_absolute() or ".." in path.parts or
            any(character in path.as_posix() for character in (",", "\n", "\r", "\\", "\0"))):
        fail("Backup path must be absolute, canonical, and safe for a read-only bind")
    if path.parent != allowed_root or path.resolve(strict=True) != path:
        fail("Backup must be a canonical file directly inside the FourBubbles backup directory")
    if any(part.is_symlink() for part in (path, *path.parents)):
        fail("Symlink backup paths are not permitted")
    match = re.fullmatch(r"fourbubbles-(\d{8}T\d{6}Z)\.dump", path.name)
    if not match:
        fail("Backup filename is not a FourBubbles timestamped dump")
    try:
        datetime.strptime(match[1], "%Y%m%dT%H%M%SZ")
    except ValueError:
        fail("Backup filename has an invalid timestamp")
    info = path.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
        fail("Backup must be a regular file without hard links")
    if private and info.st_mode & 0o077:
        fail("Backup must be private (no group or other permissions)")
    if not 5 < info.st_size <= MAX_DUMP_SIZE:
        fail("Backup exceeds this synthetic demo probe's size limits")
    with path.open("rb") as stream:
        if stream.read(5) != b"PGDMP":
            fail("Backup is not a PostgreSQL custom-format archive")
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, digest(path))


def local_endpoint(value):
    if value not in LOCAL_ENDPOINTS:
        fail("Docker must use the local Linux Unix socket")
    return value


def run(command, payload=None, phase="operation", timeout=180, environment=None):
    try:
        result = subprocess.run(command, input=payload, text=True, capture_output=True,
                                timeout=timeout, env=environment)
    except (subprocess.TimeoutExpired, OSError):
        fail(f"{phase} could not finish; command output withheld")
    if result.returncode:
        fail(f"{phase} failed (exit {result.returncode}); command output withheld")
    return result.stdout.strip()


def owned_container(inspection, name, probe_id):
    container_id = inspection.get("Id", "")
    if (inspection.get("Config", {}).get("Labels", {}).get(LABEL) != probe_id or
            inspection.get("Name") != "/" + name or
            not re.fullmatch(r"[0-9a-f]{64}", container_id)):
        fail("Refusing to use or remove a container not owned by this probe")
    return container_id


def check_isolation(inspection, name, probe_id, image_id, backup):
    owned_container(inspection, name, probe_id)
    config = inspection["HostConfig"]
    if (inspection.get("Image") != image_id or config.get("NetworkMode") != "none" or
            config.get("PortBindings") or config.get("PublishAllPorts") or
            config.get("Privileged") or config.get("Binds") or config.get("VolumesFrom") or
            config.get("Memory") != MEMORY or config.get("MemorySwap") != MEMORY or
            config.get("NanoCpus") != 500000000 or config.get("PidsLimit") != 128):
        fail("Restore container isolation or resource limits differ from the reviewed configuration")
    if config.get("Tmpfs") != {DATA_PATH: "rw,size=384m,mode=0700"}:
        fail("Restore database must use only the reviewed 384 MiB memory storage")
    mounts = inspection.get("Mounts", [])
    binds = [mount for mount in mounts if mount.get("Type") == "bind"]
    if (len(binds) != 1 or binds[0].get("Source") != str(backup) or
            binds[0].get("Destination") != DUMP_PATH or binds[0].get("RW") is not False or
            any(mount.get("Type") not in {"bind", "tmpfs"} or
                (mount.get("Type") == "tmpfs" and mount.get("Destination") != DATA_PATH)
                for mount in mounts)):
        fail("Restore container must mount only its private read-only dump and temporary database")


SUMMARY_SQL = """SELECT json_build_object(
  'clients', (SELECT count(*) FROM public.clients),
  'syntheticClients', (SELECT count(*) FROM public.clients
    WHERE acquisition_source='DEMO_SINTETICA'
      AND last_name IN ('Demo Scalaris Uno','Demo Scalaris Dos','Demo Scalaris Tres')),
  'orders', (SELECT count(*) FROM public.laundry_orders),
  'syntheticOrders', (SELECT count(*) FROM public.laundry_orders
    WHERE notes ~ '^SCALARIS-DEMO-00[123] - '),
  'cycles', (SELECT count(*) FROM public.production_cycles),
  'completedCycles', (SELECT count(*) FROM public.production_cycles WHERE status='COMPLETED'),
  'syntheticCycles', (SELECT count(*) FROM public.production_cycles
    WHERE idempotency_key IN ('scalaris-demo-v1-wash','scalaris-demo-v1-dry')),
  'users', (SELECT count(*) FROM public.app_users),
  'roleRows', (SELECT count(*) FROM public.app_user_roles),
  'viewerAccounts', (SELECT count(*) FROM public.app_users u WHERE u.enabled AND
    ARRAY(SELECT r.role::text FROM public.app_user_roles r WHERE r.user_id=u.id ORDER BY r.role)
      = ARRAY['REPORT_VIEWER']::text[]),
  'adminAccounts', (SELECT count(*) FROM public.app_users u WHERE u.enabled AND
    ARRAY(SELECT r.role::text FROM public.app_user_roles r WHERE r.user_id=u.id ORDER BY r.role)
      = ARRAY['ADMIN']::text[]),
  'migrations', (SELECT json_agg(json_build_object(
    'version',version,'type',type,'script',script,'success',success) ORDER BY installed_rank)
    FROM public.flyway_schema_history),
  'databaseOwner', (SELECT pg_get_userbyid(datdba)='fourbubbles_demo'
    FROM pg_database WHERE datname=current_database()),
  'tableOwners', (SELECT count(*)=6 AND bool_and(pg_get_userbyid(c.relowner)='fourbubbles_demo')
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN ('clients','laundry_orders','production_cycles',
                       'app_users','app_user_roles','flyway_schema_history'))
);"""


def check_summary(summary):
    expected = {"clients": 3, "syntheticClients": 3, "orders": 3, "syntheticOrders": 3,
                "cycles": 2, "completedCycles": 2, "syntheticCycles": 2,
                "users": 2, "roleRows": 2, "viewerAccounts": 1, "adminAccounts": 1}
    if any(type(summary.get(key)) is not int or summary[key] != count for key, count in expected.items()):
        fail("Restored counts, synthetic markers, or exact single-role accounts differ from the demo fixture")
    migrations = [{"version": str(index), "type": "SQL", "script": script, "success": True}
                  for index, script in enumerate(MIGRATION_SCRIPTS, 1)]
    if summary.get("migrations") != migrations:
        fail("Restored Flyway history must be exactly the eleven successful V1 to V11 SQL migrations")
    if summary.get("databaseOwner") is not True or summary.get("tableOwners") is not True:
        fail("Restored database and application table owners differ from the source role")


def main(args):
    if sys.platform != "linux":
        fail("The restore probe requires the Linux VPS")
    backup = Path(args.backupfile)
    original = check_backup(backup)
    # A context environment override takes precedence over DOCKER_HOST. Reject it
    # and explicitly select the verified local socket on every Docker invocation.
    if os.environ.get("DOCKER_CONTEXT"):
        fail("An environment-selected Docker context is not permitted")
    environment = os.environ.copy()
    for key in ("DOCKER_CONTEXT", "DOCKER_HOST", "DOCKER_TLS", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH"):
        environment.pop(key, None)
    host = os.environ.get("DOCKER_HOST")
    if host:
        endpoint = local_endpoint(host)
    else:
        context = json.loads(run(["docker", "context", "inspect"],
                                 phase="Docker context inspection", environment=environment))
        endpoint = local_endpoint(context[0]["Endpoints"]["docker"]["Host"])
    docker = ["docker", "--host", endpoint]

    def invoke(arguments, payload=None, phase="operation", timeout=180):
        return run(docker + arguments, payload, phase, timeout, environment)

    image = json.loads(invoke(["image", "inspect", IMAGE], phase="Cached PostgreSQL 16 image inspection"))[0]
    image_id = image["Id"]
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", image_id):
        fail("Cached PostgreSQL image identity is invalid")
    probe_id = uuid.uuid4().hex
    name = f"scalaris-fourbubbles-restore-{probe_id}"
    attempted = False
    report = {"checks": [], "existingDatabaseModified": False,
              "temporaryContainerRemoved": False, "backupSha256": original[-1]}
    try:
        command = ["run", "--detach", "--pull=never", "--name", name,
                   "--label", f"{LABEL}={probe_id}", "--network", "none",
                   "--memory", "512m", "--memory-swap", "512m", "--cpus", "0.5", "--pids-limit", "128",
                   "--tmpfs", f"{DATA_PATH}:rw,size=384m,mode=0700",
                   "--env", f"POSTGRES_USER={DB_USER}", "--env", f"POSTGRES_DB={DATABASE}",
                   "--env", "POSTGRES_HOST_AUTH_METHOD=trust",
                   "--mount", f"type=bind,src={backup},dst={DUMP_PATH},readonly", image_id,
                   "postgres", "-c", "shared_buffers=64MB", "-c", "max_connections=20",
                   "-c", "max_wal_size=128MB"]
        attempted = True
        invoke(command, phase="Isolated temporary PostgreSQL startup")
        inspection = json.loads(invoke(["inspect", name], phase="Temporary container isolation inspection"))[0]
        check_isolation(inspection, name, probe_id, image_id, backup)
        report["checks"].append("LOCAL_DOCKER_CACHED_IMAGE_NO_NETWORK_NO_PORTS_READONLY_DUMP_TMPFS_LIMITS")
        deadline = time.monotonic() + 120
        while True:
            try:
                # TCP refuses the entrypoint's temporary Unix-only init server.
                invoke(["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", DB_USER, "-d", DATABASE],
                       phase="Temporary PostgreSQL readiness", timeout=10)
                break
            except RuntimeError:
                if time.monotonic() >= deadline:
                    fail("Temporary PostgreSQL did not become ready")
                time.sleep(1)
        invoke(["exec", name, "pg_restore", "--list", DUMP_PATH], phase="Custom archive table of contents")
        # Preserve source ownership and ACLs: the source role is created by the
        # official image; no --no-owner, --no-acl, role filtering, or app env.
        # docker exec defaults to root, so the private root:root dump stays 0600.
        invoke(["exec", name, "pg_restore", "--exit-on-error", "--clean", "--if-exists",
                "--username", DB_USER, "--dbname", DATABASE, DUMP_PATH],
               phase="Full ownership and ACL restore", timeout=240)
        report["checks"].append("PG_RESTORE_CUSTOM_WITH_OWNERS_AND_ACL")
        summary = json.loads(invoke(["exec", "-i", name, "psql", "--no-psqlrc", "--quiet",
                                    "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
                                    "--username", DB_USER, "--dbname", DATABASE],
                                   SUMMARY_SQL + "\n", phase="Restored synthetic fixture validation"))
        check_summary(summary)
        if check_backup(backup) != original:
            fail("Backup file changed during validation")
        report["checks"].extend(["3_SYNTHETIC_CLIENTS_3_ORDERS_2_COMPLETED_CYCLES",
                                 "11_SUCCESSFUL_FLYWAY_SQL_MIGRATIONS",
                                 "1_ENABLED_REPORT_VIEWER_ONLY_1_ENABLED_ADMIN_ONLY",
                                 "SOURCE_DATABASE_AND_TABLE_OWNERS_PRESERVED", "BACKUP_BYTES_UNCHANGED"])
    finally:
        if attempted:
            # Inspect only our UUID name and remove only its verified immutable ID.
            try:
                result = subprocess.run(docker + ["inspect", name], capture_output=True,
                                        text=True, timeout=30, env=environment)
            except (subprocess.TimeoutExpired, OSError):
                fail("Temporary container cleanup inspection could not finish")
            if result.returncode == 0:
                owned = json.loads(result.stdout)[0]
                owned_id = owned_container(owned, name, probe_id)
                invoke(["rm", "--force", "--volumes", owned_id],
                       phase="Owned temporary container cleanup", timeout=60)
                report["temporaryContainerRemoved"] = True
            elif "no such object" in result.stderr.lower() or "no such container" in result.stderr.lower():
                report["temporaryContainerRemoved"] = True
            else:
                fail("Temporary container cleanup could not be confirmed")
    report["result"] = "PASS_ISOLATED_FULL_ACL_RESTORE"
    print(json.dumps(report, sort_keys=True))


def self_test():
    checks = 0

    def rejected(function, *arguments, **keywords):
        nonlocal checks
        try:
            function(*arguments, **keywords)
        except (RuntimeError, FileNotFoundError):
            checks += 1
            return
        raise AssertionError("A forbidden validation boundary was accepted")

    for value in ("tcp://127.0.0.1:2375", "ssh://root@example.invalid", "npipe:////./pipe/docker_engine", ""):
        rejected(local_endpoint, value)
    assert all(local_endpoint(value) == value for value in LOCAL_ENDPOINTS)
    with tempfile.TemporaryDirectory(prefix="scalaris-fourbubbles-restore-selftest-") as temporary:
        root = Path(temporary).resolve()
        backup = root / "fourbubbles-20261022T012755Z.dump"
        backup.write_bytes(b"PGDMPsynthetic guard fixture only")
        backup.chmod(0o600)
        private = os.name == "posix"
        original = check_backup(backup, root, private)
        rejected(check_backup, Path(backup.name), root, private)
        rejected(check_backup, backup, root / "another", private)
        rejected(check_backup, root / ".." / root.name / backup.name, root, private)
        for name in ("database.dump", "fourbubbles-20261322T012755Z.dump", "fourbubbles-20261022T012755Z.dump,unsafe"):
            file = root / name
            file.write_bytes(backup.read_bytes())
            file.chmod(0o600)
            rejected(check_backup, file, root, private)
        backup.write_bytes(b"plain SQL is not a custom dump")
        rejected(check_backup, backup, root, private)
        backup.write_bytes(b"PGDMPmodified guard fixture")
        assert check_backup(backup, root, private) != original
        if private:
            backup.chmod(0o644)
            rejected(check_backup, backup, root, True)
            backup.chmod(0o600)
            link = root / "fourbubbles-20261022T012756Z.dump"
            link.symlink_to(backup)
            rejected(check_backup, link, root, True)
            link.unlink()
            os.link(backup, link)
            rejected(check_backup, backup, root, True)
            link.unlink()
        name = "scalaris-fourbubbles-restore-" + "a" * 32
        probe_id, image_id = "a" * 32, "sha256:" + "b" * 64
        inspection = {"Id": "c" * 64, "Name": "/" + name, "Image": image_id,
                      "Config": {"Labels": {LABEL: probe_id}}, "HostConfig": {
                          "NetworkMode": "none", "Memory": MEMORY, "MemorySwap": MEMORY,
                          "NanoCpus": 500000000, "PidsLimit": 128,
                          "Tmpfs": {DATA_PATH: "rw,size=384m,mode=0700"}},
                      "Mounts": [{"Type": "bind", "Source": str(backup), "Destination": DUMP_PATH, "RW": False}]}
        check_isolation(inspection, name, probe_id, image_id, backup)
        for key, value in (("NetworkMode", "bridge"), ("Memory", 0), ("MemorySwap", -1),
                           ("NanoCpus", 0), ("PidsLimit", 0), ("Tmpfs", {}),
                           ("PortBindings", {"5432/tcp": [{"HostPort": "5432"}]}),
                           ("Privileged", True), ("VolumesFrom", ["production"])):
            changed = copy.deepcopy(inspection)
            changed["HostConfig"][key] = value
            rejected(check_isolation, changed, name, probe_id, image_id, backup)
        for change in ({"RW": True}, {"Source": "/production/database.dump"}, {"Type": "volume"}):
            changed = copy.deepcopy(inspection)
            changed["Mounts"][0].update(change)
            rejected(check_isolation, changed, name, probe_id, image_id, backup)
        for key, value in (("Name", "/production"), ("Id", "invalid"), ("Config", {"Labels": {LABEL: "other"}})):
            changed = copy.deepcopy(inspection)
            changed[key] = value
            rejected(owned_container, changed, name, probe_id)
    summary = {"clients": 3, "syntheticClients": 3, "orders": 3, "syntheticOrders": 3,
               "cycles": 2, "completedCycles": 2, "syntheticCycles": 2,
               "users": 2, "roleRows": 2, "viewerAccounts": 1, "adminAccounts": 1,
               "migrations": [{"version": str(index), "type": "SQL", "script": script, "success": True}
                              for index, script in enumerate(MIGRATION_SCRIPTS, 1)],
               "databaseOwner": True, "tableOwners": True}
    check_summary(summary)
    for key, value in (("clients", 4), ("completedCycles", 1), ("roleRows", 3),
                       ("viewerAccounts", 0), ("adminAccounts", 0), ("databaseOwner", False),
                       ("tableOwners", False), ("migrations", summary["migrations"][:-1])):
        rejected(check_summary, {**summary, key: value})
    changed = copy.deepcopy(summary)
    changed["migrations"][0]["success"] = False
    rejected(check_summary, changed)
    print(json.dumps({"result": "PASS_GUARD_SELF_TESTS", "rejectedBoundaries": checks,
                      "dockerExecuted": False, "actualBackupRestored": False}, sort_keys=True))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backupfile", help="Existing private FourBubbles custom dump in its fixed VPS backup directory")
    parser.add_argument("--self-test", action="store_true")
    arguments = parser.parse_args()
    try:
        if arguments.self_test:
            self_test()
        elif not arguments.backupfile:
            parser.error("--backupfile is required unless --self-test is selected")
        else:
            main(arguments)
    except Exception as error:
        # SQL results, Docker output, environment, and credential values stay private.
        message = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        print(f"RESTORE_VALIDATION_FAILED: {message}", file=sys.stderr)
        sys.exit(1)
