## Usage

Run `npm run start` and visit [`localhost:8000`](localhost:8000) in a browser.  

The environment variables VIAM_LOCATION and VIAM_SECRET must be set, so you can set them separately or start like:

`export VIAM_LOCATION=mylocation;VIAM_SECRET=mysecret;npm run start`

Simple interface: run `npm run start-simple` (environment variables must be set as per above).

Edit `src/main.ts` to change the robot logic being run. Edit `static/index.html` to change the layout of the app.

# obstacles.json

This file is the single point of truth for the configuration of the claw-game's environment.  Obstacles specified through this 
file will comprise the WorldState and be respected for all motions that the arm takes

# visualize.go

A minimal visualization of the robot and the enclosure it is configured with.  Leverages Viam's unofficial [visualization](https://github.com/viamrobotics/visualization) package 

`go run visualize.go -location=VIAM_LOCATION -secret=VIAM_SECRET`

# CLI-test.py

Basic CLI script for testing the claw game.  You can run individual commands, for example:

`python3 CLI-test.py --password mypass --location mylocation --command grab`

Or, you can run sequences of commands like:

`python3 CLI-test.py --password mypass --location mylocation --command sequence --sequence grab,sleep,release,sleep,grab,sleep,release`
