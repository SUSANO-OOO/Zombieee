set pagination off
set confirm off
set print frame-arguments none
set print elements 16
set backtrace limit 24
set detach-on-fork on
handle SIGPIPE nostop noprint pass
handle SIGUSR1 SIGUSR2 SIGALRM SIGCHLD SIGTERM nostop noprint pass
handle SIG32 nostop noprint pass
handle SIG33 nostop noprint pass
handle SIG34 nostop noprint pass
handle SIG35 nostop noprint pass
handle SIG36 nostop noprint pass
handle SIG37 nostop noprint pass
handle SIG38 nostop noprint pass
handle SIG39 nostop noprint pass
handle SIG40 nostop noprint pass
handle SIGSEGV stop print pass
handle SIGABRT stop print pass
handle SIGBUS stop print pass
handle SIGILL stop print pass
handle SIGFPE stop print pass
python
import gdb
print("NATIVE_DEBUGGER_ATTACHED", gdb.selected_inferior().pid)
# Diagnostic only: retain real signals, never repair/skip a faulting instruction.
# Some engines use handled signals. Capture up to eight stops and pass each on;
# only actual process exit / page crash establishes a fatal failure.
try:
    for ordinal in range(1, 9):
        gdb.execute("continue")
        if gdb.selected_inferior().pid == 0:
            print("NATIVE_PROCESS_EXITED")
            break
        print("NATIVE_STOP", ordinal)
        gdb.execute("info program")
        try:
            gdb.execute("p $_siginfo.si_signo")
        except gdb.error as error:
            print("SIGNAL_INFO_UNAVAILABLE", error)
        gdb.execute("thread apply all bt 12")
        gdb.execute("info registers")
        gdb.execute("info sharedlibrary")
    else:
        print("NATIVE_DIAGNOSTIC_STOP_LIMIT_REACHED_NOT_ACCEPTANCE")
finally:
    if gdb.selected_inferior().pid:
        gdb.execute("detach")
end
