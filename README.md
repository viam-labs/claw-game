## Usage

Run `npm run start` and visit `localhost:8000` in a browser.  
The environment variables VIAM_LOCATION and VIAM_SECRET must be set, so you can set them separately or start like:
`export VIAM_LOCATION=mylocation;VIAM_SECRET=mysecret;npm run start`

Edit `src/main.ts` to change the robot logic being run. Edit `static/index.html` to change the layout of the app.


# control.py

Basic CLI script for testing the claw game.  You can run individual commands, for example:

`python3 control.py --password mypass --location mylocation --command grab`

Or, you can run sequences of commands like:

`python3 control.py --password mypass --location mylocation --command sequence --sequence grab,sleep,release,sleep,grab,sleep,release`
