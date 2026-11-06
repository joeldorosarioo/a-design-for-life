# Owned PostgreSQL cleanup receipt

Native run `6a1f6dc0-cd65-4950-a16e-2998fa22771b` finished with one passing Vitest test and exit 0. The wrapper’s immediate TCP-table check then exited 1. The failure and the successful Vitest exit remain separately visible in the tool receipts.

The follow-up Docker checks filtered by the exact captured IDs and returned no records for container `9c7f8c4b047ac28c15441cf85ada21fb5ca4d89da99fb1a79f90ee5a5d02ea20` or network `be4002906071d579370632d289dd19d70ada78e703493b89d585514cefbc38cb`. `docker --context desktop-linux ps --filter publish=55434` returned no publisher and exit 0. The current-user lifecycle lease was absent. The Windows TCP table reported a `127.0.0.1:55434` row with owning PID 0 (`Idle`). A direct pinned Node `net.Server.listen(55434, '127.0.0.1')`, matching the owned lifecycle’s actual availability test, succeeded and closed. No further database lifecycle was started before reporting release.
