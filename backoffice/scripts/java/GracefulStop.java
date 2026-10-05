import com.sun.tools.attach.VirtualMachine;
import java.lang.instrument.Instrumentation;

/** Local JDK Attach signal; System.exit executes Spring/JVM shutdown hooks. */
public final class GracefulStop {
  public static void agentmain(String ignored, Instrumentation instrumentation) {
    new Thread(() -> System.exit(0), "scalaris-script-stop").start();
  }

  public static void main(String[] args) throws Exception {
    VirtualMachine vm = VirtualMachine.attach(args[0]);
    try {
      vm.loadAgent(args[1]);
    } finally {
      vm.detach();
    }
  }
}
