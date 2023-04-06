# claw-game-testing

Basic CLI script for testing the claw game.  You can run individual commands, for example:

`python3 control.py --password mypass --location mylocation --command grab`

Or, you can run sequences of commands like:

`python3 control.py --password mypass --location mylocation --command sequence --sequence grab,sleep,release,sleep,grab,sleep,release`
