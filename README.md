## Usage

Run `npm run start` and visit [`localhost:8000`](localhost:8000) in a browser.  

The environment variables `VIAM_LOCATION`, `VIAM_API_KEY_ID`, and `VIAM_API_KEY` must be set in a `.env` file within the root project directory, you can make a copy of the `.env.example` file to get started.

The `.env.example` also includes variables to configure the names of the board, arm, motion, and (optional) gripper component/service names based on the machine configuration with the default values:

```
ARM_CLIENT_NAME="myArm"
BOARD_CLIENT_NAME="myBoard"
GRIPPER_CLIENT_NAME="myGripper"
MOTION_CLIENT_NAME="builtin"
```

If you want to enable error monitoring in the application, the [Sentry DSN](https://docs.sentry.io/platforms/javascript/#configure) as `SENTRY_DSN` in the `.env` file.

Simple interface: run `npm run start-simple` (environment variables must be set as per above).

Edit `src/main.ts` to change the robot logic being run. Edit `static/index.html` to change the layout of the app.

# obstacles.json

This file is the single point of truth for the configuration of the claw-game's environment.  Obstacles specified through this 
file will comprise the WorldState and be respected for all motions that the arm takes

# visualize.go

A minimal visualization of the robot and the enclosure it is configured with.  Leverages Viam's unofficial [visualization](https://github.com/viamrobotics/visualization) package 

`go run visualize.go -location=VIAM_LOCATION -apikeyid=VIAM_API_KEY_ID -apikey=VIAM_API_KEY`

# CLI-test.py

Basic CLI script for testing the claw game.  You can run individual commands, for example:

`python3 CLI-test.py --location VIAM_LOCATION --apikeyid VIAM_API_KEY_ID --apikey VIAM_API_KEY --command grab`

Or, you can run sequences of commands like:

`python3 CLI-test.py --location mylocation --apikeyid VIAM_API_KEY_ID --apikey VIAM_API_KEY --command sequence --sequence grab,sleep,release,sleep,grab,sleep,release`

## Webserver module configuration

### Attributes

The following attributes are available for this model:

| Name                | Type    | Inclusion | Description                                                                         |
| ------------------- | ------- | --------- | ----------------------------------------------------------------------------------- |
| `port`              | integer | Optional  | Configure the port the webserver listens on. Default is `8888`                      |
| `arm`            | string  | Required  | The name of the arm component you want to use                      |
| `board`            | string  | Required  | The name of the board component you want to use                      |
| `gripper`            | string  | Required  | The name of the gripper component you want to use                      |
| `motion`            | string  | Required  | The name of the motion service you want to use, typically this is "builtin"                      |
| `sentry`            | string  | Optional  | The DSN for Sentry error monitoring                      |

### Example configuration:

```json
{
  "port": 33333,
  "arm": "arm-1",
  "board": "board-1",
  "gripper": "gripper-1",
  "motion": "builtin",
  "sentry": "sentryDSN"
}
```

## Less obvious features

You can access the Viam configuration in your frontend code using the `http://.../config.json` endpoint.

```json
{
  "name": "ui",
  "api": "rdk:service:generic",
  "model": "devrel:claw-game:webapp",
  "attributes": {
    "arm": "arm-1",
    "board": "board-1"
  }
}
```
