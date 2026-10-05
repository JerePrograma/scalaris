package ar.scalaris.storage;

import java.io.BufferedReader;
import java.io.InputStreamReader;

/** Separate JVM helper: it only locks a disposable directory supplied by StorageLockTest. */
public final class StorageLockProcess {
  public static void main(String[] args) throws Exception {
    try (var ignored = new StorageLock(args[0])) {
      System.out.println("READY");
      System.out.flush();
      if (args[1].equals("hold"))
        new BufferedReader(new InputStreamReader(System.in)).readLine();
    } catch (Exception e) {
      System.out.println("REJECTED " + e.getClass().getSimpleName() + ": " + e.getMessage());
      System.out.flush();
      System.exit(3);
    }
  }
}
