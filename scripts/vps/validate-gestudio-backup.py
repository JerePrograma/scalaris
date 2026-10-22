#!/usr/bin/env python3
"""Validate an isolated synthetic Gestudio backup, never the running database."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile
import tempfile
import time
import uuid

IMAGE = "postgres:15.18-alpine3.24"
LABEL = "io.scalaris.gestudio-restore-probe"


def fail(message):
    raise RuntimeError(message)


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def archive_path(name):
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or "\\" in name:
        fail("Receipt archive contains an unsafe path")
    return path.as_posix().removeprefix("./")


def check_backup(backup):
    manifest = backup / "SHA256SUMS"
    expected = {"database.dump", "receipts.tar.gz"}
    entries = {}
    for line in manifest.read_text(encoding="utf-8").splitlines():
        match = re.fullmatch(r"([0-9a-f]{64}) [ *](database\.dump|receipts\.tar\.gz)", line)
        if not match or match[2] in entries:
            fail("Backup checksum manifest is unexpected")
        entries[match[2]] = match[1]
    if set(entries) != expected:
        fail("Backup checksum manifest is incomplete")
    for name, checksum in entries.items():
        file = backup / name
        if file.is_symlink() or not file.is_file() or file.stat().st_size == 0 or digest(file) != checksum:
            fail("Backup file is missing or its checksum differs")
    receipt_files = set()
    total_size = 0
    count = 0
    with tarfile.open(backup / "receipts.tar.gz", "r:gz") as archive:
        for member in archive:
            count += 1
            total_size += member.size
            if count > 10000 or total_size > 256 * 1024 * 1024:
                fail("Receipt archive exceeds this synthetic probe's limits")
            name = archive_path(member.name)
            if member.isdir():
                continue
            if not member.isfile() or not name or name in receipt_files:
                fail("Receipt archive contains an unsupported or repeated entry")
            receipt_files.add(name)
            stream = archive.extractfile(member)
            if stream is None:
                fail("Receipt archive member cannot be read")
            read = 0
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                read += len(block)
            if read != member.size:
                fail("Receipt archive member is truncated")
    return receipt_files


def run(command, payload=None, phase="operation", timeout=180, ok=(0,)):
    try:
        result = subprocess.run(command, input=payload, text=True, capture_output=True, timeout=timeout)
    except (subprocess.TimeoutExpired, OSError):
        fail(f"{phase} could not finish; command output withheld")
    if result.returncode not in ok:
        fail(f"{phase} failed (exit {result.returncode}); command output withheld")
    return result.stdout.strip()


def main(args):
    if os.name != "posix":
        fail("The restore probe requires the Linux VPS")
    app = Path(args.app_root).absolute()
    backup = Path(args.backup).absolute()
    if app.resolve() != app or backup.resolve() != backup:
        fail("App and backup paths must be canonical directories")
    for path in (app, backup):
        if any(character in str(path) for character in (",", "\n", "\r")):
            fail("Unsupported bind-mount path")
    env_file = app / ".env"
    init_roles = app / "scripts/db/10-create-application-role.sh"
    if env_file.is_symlink() or not env_file.is_file() or env_file.stat().st_mode & 0o077:
        fail("The existing app .env must be a private regular file")
    if init_roles.is_symlink() or not init_roles.is_file():
        fail("Official role initialization script is missing")
    receipts = check_backup(backup)
    if os.environ.get("DOCKER_CONTEXT"):
        fail("An environment-selected Docker context is not permitted")
    docker_host = os.environ.get("DOCKER_HOST", "")
    if docker_host and docker_host not in {"unix:///var/run/docker.sock", "unix:///run/docker.sock"}:
        fail("Remote Docker endpoints are not permitted")
    if not docker_host:
        context = json.loads(run(["docker", "context", "inspect"], phase="Docker context inspection"))
        endpoint = context[0]["Endpoints"]["docker"]["Host"]
        if endpoint not in {"unix:///var/run/docker.sock", "unix:///run/docker.sock"}:
            fail("Docker context must use the local Unix socket")
    image = json.loads(run(["docker", "image", "inspect", IMAGE], phase="Cached PostgreSQL image inspection"))[0]
    image_id = image["Id"]
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", image_id):
        fail("Cached PostgreSQL image identity is invalid")

    probe_id = uuid.uuid4().hex
    name = f"scalaris-gestudio-restore-{probe_id}"
    attempted = False
    report = {"checks": [], "existingDatabaseModified": False, "temporaryContainerRemoved": False}

    def sql(statement, phase="SQL validation"):
        return run(["docker", "exec", "-i", name, "sh", "-ec",
                    'exec psql --no-psqlrc --quiet --tuples-only --no-align --set ON_ERROR_STOP=1 '
                    '--username="$POSTGRES_USER" --dbname="$POSTGRES_DB" '
                    '--set "application_role=$POSTGRES_APP_USER"'], statement + "\n", phase=phase)

    try:
        command = ["docker", "run", "--detach", "--pull=never", "--name", name,
                   "--label", f"{LABEL}={probe_id}", "--network", "none",
                   "--memory", "512m", "--memory-swap", "512m", "--cpus", "0.5", "--pids-limit", "128",
                   "--tmpfs", "/var/lib/postgresql/data:rw,size=384m,mode=0700",
                   "--env-file", str(env_file),
                   "--mount", f"type=bind,src={init_roles},dst=/docker-entrypoint-initdb.d/10-create-application-role.sh,readonly",
                   "--mount", f"type=bind,src={backup},dst=/restore,readonly", image_id]
        attempted = True
        run(command, phase="Isolated restore container startup")
        inspection = json.loads(run(["docker", "inspect", name], phase="Restore container isolation inspection"))[0]
        config = inspection["HostConfig"]
        if (config["NetworkMode"] != "none" or config.get("PortBindings") or
                config.get("Binds") or config.get("VolumesFrom") or
                any(mount["Type"] == "volume" or (mount["Type"] == "bind" and mount["RW"]) for mount in inspection["Mounts"])):
            fail("Restore container isolation differs from the reviewed configuration")
        if not config.get("Tmpfs", {}).get("/var/lib/postgresql/data"):
            fail("Restore database is not confined to temporary memory storage")
        report["checks"].append("ISOLATION_NO_NETWORK_NO_PORTS_READ_ONLY_BINDS_TMPFS")
        ready = False
        for _ in range(90):
            result = subprocess.run(["docker", "exec", name, "sh", "-ec",
                                     'pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
                                    capture_output=True, timeout=10)
            if result.returncode == 0:
                ready = True
                break
            time.sleep(1)
        if not ready:
            fail("Temporary PostgreSQL did not become ready")
        sql("CREATE ROLE gestudio_health NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;",
            phase="Health role recreation")
        run(["docker", "exec", name, "sh", "-ec",
             'exec pg_restore --exit-on-error --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" /restore/database.dump'],
            phase="Full ownership and ACL restore", timeout=240)
        report["checks"].append("PG_RESTORE_WITH_OWNERS_AND_ACL")
        summary = json.loads(sql("""SELECT json_build_object(
            'students', (SELECT count(*) FROM public.alumnos),
            'tenants', (SELECT count(*) FROM public.tenants),
            'health', public.gestudio_multitenancy_health(),
            'migrations', (SELECT json_agg(json_build_object('version',version,'type',type,'script',script,'success',success)) FROM public.flyway_schema_history),
            'tenantRows', (SELECT json_agg(json_build_object('id',id,'code',code)) FROM public.tenants),
            'receipts', (SELECT coalesce(json_agg(storage_key),'[]'::json) FROM public.recibos WHERE storage_key IS NOT NULL));"""))
        if summary["students"] != 28 or summary["tenants"] != 2 or summary["health"] != "GREEN":
            fail("Restored synthetic counts or multitenancy health differ from the expected fixture")
        migrations = summary["migrations"]
        if migrations != [{"version": "12", "type": "SQL_BASELINE", "script": "B12__gestudio_production_baseline.sql", "success": True}]:
            fail("Restored Flyway history is not the expected successful B12 baseline")
        tenants = {item["code"]: str(uuid.UUID(item["id"])) for item in summary["tenantRows"]}
        alpha = tenants.get("escuela-danza-marcos-paz")
        beta = tenants.get("escuela-beta-demo")
        if not alpha or not beta:
            fail("Restored tenant identities differ from the reviewed fixture")
        for key in summary["receipts"]:
            if archive_path(key) not in receipts:
                fail("A restored receipt references a file absent from the archive")
        report["checks"].extend(["28_STUDENTS_2_TENANTS", "FLYWAY_B12_BASELINE", "MULTITENANCY_HEALTH_GREEN", "RECEIPT_HASHES_ARCHIVE_AND_REFERENCES"])
        role_result = sql(f"""SELECT format('SET ROLE %I', :'application_role') \\gexec
DO $$
DECLARE visible bigint; leaked bigint; rejected boolean := false;
BEGIN
  IF (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user)
     OR NOT pg_has_role(current_user, 'gestudio_app', 'member')
     OR pg_has_role(current_user, 'gestudio_platform', 'member') THEN
    RAISE EXCEPTION 'Application role boundary differs';
  END IF;
  PERFORM set_config('app.current_tenant_id', '{alpha}', false);
  SELECT count(*), count(*) FILTER (WHERE tenant_id <> '{alpha}'::uuid) INTO visible, leaked FROM public.alumnos;
  IF visible <> 28 OR leaked <> 0 THEN RAISE EXCEPTION 'Alpha isolation differs'; END IF;
  PERFORM set_config('app.current_tenant_id', '{beta}', false);
  SELECT count(*), count(*) FILTER (WHERE tenant_id <> '{beta}'::uuid) INTO visible, leaked FROM public.alumnos;
  IF visible <> 0 OR leaked <> 0 THEN RAISE EXCEPTION 'Beta isolation differs'; END IF;
  PERFORM set_config('app.current_tenant_id', '', false);
  BEGIN
    PERFORM 1 FROM public.alumnos LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM = 'tenant context missing' THEN rejected := true; ELSE RAISE; END IF;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Missing tenant context was accepted'; END IF;
END;
$$;
RESET ROLE;
SELECT 'PASS_APPLICATION_ROLE_ALPHA_BETA_AND_MISSING_CONTEXT';""", phase="Restored application-role RLS validation")
        if role_result != "PASS_APPLICATION_ROLE_ALPHA_BETA_AND_MISSING_CONTEXT":
            fail("Application-role RLS validation did not finish")
        report["checks"].append("APP_ROLE_ALPHA_28_BETA_0_MISSING_CONTEXT_42501")
    finally:
        if attempted:
            result = subprocess.run(["docker", "inspect", name], capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                owned = json.loads(result.stdout)[0]
                if owned["Config"].get("Labels", {}).get(LABEL) != probe_id or owned["Name"] != "/" + name:
                    fail("Refusing cleanup of a container not owned by this probe")
                run(["docker", "rm", "--force", "--volumes", owned["Id"]], phase="Owned temporary container cleanup", timeout=60)
                report["temporaryContainerRemoved"] = True
            elif "no such object" in result.stderr.lower() or "no such container" in result.stderr.lower():
                report["temporaryContainerRemoved"] = True
            else:
                fail("Temporary container cleanup could not be confirmed")
    report["result"] = "PASS_ISOLATED_FULL_ACL_RESTORE"
    print(json.dumps(report, sort_keys=True))


def self_test():
    for invalid in ("../secret", "/etc/passwd", "a/../../b", "a\\b"):
        try:
            archive_path(invalid)
        except RuntimeError:
            continue
        raise AssertionError("Unsafe archive path accepted")
    with tempfile.TemporaryDirectory(prefix="scalaris-restore-selftest-") as temporary:
        root = Path(temporary)
        (root / "database.dump").write_bytes(b"synthetic fixture")
        with tarfile.open(root / "receipts.tar.gz", "w:gz") as archive:
            member = tarfile.TarInfo("./alpha/receipt.pdf")
            member.size = 4
            archive.addfile(member, io.BytesIO(b"%PDF"))
        def sums():
            (root / "SHA256SUMS").write_text("".join(f"{digest(root / name)}  {name}\n" for name in ("database.dump", "receipts.tar.gz")), encoding="utf-8")
        sums()
        assert check_backup(root) == {"alpha/receipt.pdf"}
        (root / "database.dump").write_bytes(b"modified fixture")
        try:
            check_backup(root)
        except RuntimeError:
            pass
        else:
            raise AssertionError("Mismatched backup checksum accepted")
        with tarfile.open(root / "receipts.tar.gz", "w:gz") as archive:
            member = tarfile.TarInfo("../escape")
            member.size = 1
            archive.addfile(member, io.BytesIO(b"x"))
        sums()
        try:
            check_backup(root)
        except RuntimeError:
            pass
        else:
            raise AssertionError("Unsafe receipt member accepted")
    print("PASS: checksum integrity and receipt archive path boundaries; Docker restore not executed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app-root", default="/srv/apps/gestudio-demo")
    parser.add_argument("--backup", help="An existing verified Gestudio snapshot directory")
    parser.add_argument("--self-test", action="store_true")
    arguments = parser.parse_args()
    try:
        if arguments.self_test:
            self_test()
        elif not arguments.backup:
            parser.error("--backup is required unless --self-test is selected")
        else:
            main(arguments)
    except Exception as error:
        # SQL, Docker environment, subprocess output and credential values are never printed.
        print(f"RESTORE_VALIDATION_FAILED: {str(error) if isinstance(error, RuntimeError) else type(error).__name__}", file=sys.stderr)
        sys.exit(1)
