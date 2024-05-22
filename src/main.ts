import { Client, GripperClient, BoardClient, MotionClient, ArmClient, createRobotClient } from '@viamrobotics/sdk';
import type { ResourceName, Constraints, Pose } from '@viamrobotics/sdk';
import * as SDK from '@viamrobotics/sdk';
import { setup, fromPromise, assign, assertEvent, createActor } from 'xstate'
import * as env from 'env';
import obstacles from '../obstacles.json';

// globals
const geomList: SDK.Geometry[] = [];
for (const obs of obstacles) {
  const geom: SDK.Geometry = {
    label: obs.label,
    center: {
      x: obs.translation.x,
      y: obs.translation.y,
      z: obs.translation.z,
      oX: obs.orientation.value.x,
      oY: obs.orientation.value.y,
      oZ: obs.orientation.value.z,
      theta: obs.orientation.value.th
    },
    box: {
      dimsMm: {
        x: obs.x,
        y: obs.y,
        z: obs.z,
      }
    }
  }
  geomList.push(geom);
}

const myObstaclesInFrame: SDK.GeometriesInFrame = {
  referenceFrame: "world",
  geometriesList: geomList,
}

const myWorldState: SDK.WorldState = {
  obstaclesList: [myObstaclesInFrame],
  transformsList: [],
}

const robotAPIKey = env.VIAM_API_KEY
const robotAPIKeyID = env.VIAM_API_KEY_ID
const robotLocation = env.VIAM_LOCATION
const armClientName = env.ARM_CLIENT_NAME
const boardClientName = env.BOARD_CLIENT_NAME
const gripperClientName = env.GRIPPER_CLIENT_NAME
const motionClientName = env.MOTION_CLIENT_NAME
const grabberPin = '8'
const ignoreInterrupts = true
const moveHeight = 500
const gridSize = 3
const reachMm = 560

// if we mount the arm straight we don't need this
const offset = 0
const quadrantSize = (reachMm * 2) / gridSize
const gridPositions = {
  '1,1': { x: 270, y: 450 },
  '1,-1': { x: 300, y: -283 },
  '-1,-1': { x: -373, y: -463 },
  '-1,0': { x: -373, y: -90 },
  '-1,1': { x: -373, y: 283 },
  '0,1': { x: 0, y: 373 },
  '0,-1': { x: 0, y: -373 }
}
// if this is set to true, we calculate based on enclosure geometry
const useQuandrantMath = true

// random animations will show on move if set to true
const useAnimations = false

const constraints: Constraints = {
  orientationConstraintList: [
    { orientationToleranceDegs: 5 },
  ],
  linearConstraintList: [],
  collisionSpecificationList: [],
};

const armName: ResourceName = {
  namespace: 'rdk',
  type: 'component',
  subtype: 'arm',
  name: 'myArm'
}

type ClawMachineContext = {
  machineClient: Client,
  motionClient: MotionClient,
  boardClient: BoardClient,
  armClient: ArmClient,
  gripperClient: GripperClient,
  error: Error | null,
}

type ClientNameParams = Record<'boardClientName' | 'armClientName' | 'motionClientName' | 'gripperClientName', string>

type MoveInput = (ClawMachineContext & {
  target: 'quadrant' | 'planar';
  x: number;
  y: number;
}) | (ClawMachineContext & {
  target: 'home'
});

type ClawMachineEvent = {
  type: 'retry';
} | {
  type: 'connect';
} | {
  type: 'move';
  target: 'quadrant' | 'planar';
  x: number;
  y: number;
} | {
  type: 'move';
  target: 'home';
} | {
  type: 'dropAndHome';
} | {
  type: 'xstate.error.actor.createRobotClient',
  error: Error
};

const clawMachine = setup({
  "types": {
    "context": {} as ClawMachineContext,
    "events": {} as ClawMachineEvent
  },
  "actions": {
    "assignClients": assign({
      motionClient: ({ context }, params: ClientNameParams) =>
        new MotionClient(context.machineClient, params.motionClientName),

      boardClient: ({ context }, params: ClientNameParams) =>
        new BoardClient(context.machineClient, params.boardClientName),

      armClient: ({ context }, params: ClientNameParams) =>
        new ArmClient(context.machineClient, params.armClientName),

      gripperClient: ({ context }, params: ClientNameParams) =>
        new GripperClient(context.machineClient, params.gripperClientName),
    }),
    "assignError": assign({
      error: (_, params: { error: Error }) => params.error
    }),
    "assignRobotClient": assign({
      machineClient: (_, params: { client: Client }) => {
        return params.client;
      }
    }),
    "clearError": assign({ error: null }),
    "styleMove": (_, params: { state: 'moving' | 'ready' | 'error' }) => { },
  },
  "actors": {
    "createRobotClient": fromPromise<Client, { apiKey: string, apiKeyId: string, locationAddress: string }>(
      async ({ input }) => {
        const credential = {
          type: "api-key",
          payload: input.apiKey,
        }

        //This is the host address of the main part of your robot.
        const host = input.locationAddress

        return createRobotClient({
          host,
          credential,
          authEntity: input.apiKeyId,
          signalingAddress:
            "https://app.viam.com:443",
        })
      },
    ),
    "moveHandler": fromPromise<void, MoveInput>(async ({ input }) => {
      if (input.target == "quadrant") {
        await moveToQuadrant(input.motionClient, input.armClient, input.x, input.y)
      }
      if (input.target == "planar") {
        await inPlaneMove(input.motionClient, input.armClient, input.x, input.y)
      }
      if (input.target == "home") {
        await home(input.motionClient, input.armClient)
      }
    }),
    "dropHandler": fromPromise<void, ClawMachineContext & { moveHeight: number }>(async ({ input }) => {
      await zMove(input.motionClient, input.armClient, 240)
      await grab(input.boardClient, input.gripperClient)
      await delay(1000)
      await zMove(input.motionClient, input.armClient, input.moveHeight)
      await home(input.motionClient, input.armClient)
      await delay(1000)
      await release(input.boardClient, input.gripperClient)
    })
  },
}).createMachine({
  "context": { error: null } as ClawMachineContext,
  "id": "Claw Machine",
  "initial": "initializing",
  "states": {
    "initializing": {
      "on": {
        "connect": {
          "target": "connectingToMachine"
        }
      }
    },
    "connectingToMachine": {
      "invoke": {
        "id": "clientConnection",
        "input": {
          "apiKey": robotAPIKey,
          "apiKeyId": robotAPIKeyID,
          "locationAddress": robotLocation
        },
        "onDone": {
          "target": "connected",
          "actions": {
            "type": "assignRobotClient",
            "params": ({ event }) => ({ client: event.output }),
          }
        },
        "onError": {
          "target": "clientErrored",
          "actions": {
            "type": "assignError",
            "params": ({ event }) => ({ error: event.error as Error })
          }
        },
        "src": "createRobotClient"
      }
    },
    "connected": {
      "always": {
        "target": "ready"
      },
      "entry": {
        "type": "assignClients",
        "params": {
          motionClientName,
          boardClientName,
          armClientName,
          gripperClientName,
        }
      },
    },
    "clientErrored": {
      entry: { type: "styleMove", params: { state: 'error' } },
      "on": {
        "retry": {
          "target": "initializing",
          "actions": { type: "clearError" }
        }
      }
    },
    "ready": {
      entry: { type: "styleMove", params: { state: 'ready' } },
      "on": {
        "move": {
          "target": "moving"
        },
        "dropAndHome": {
          "target": "picking"
        }
      }
    },
    "moving": {
      entry: { type: "styleMove", params: { state: 'moving' } },
      "invoke": {
        "id": "armMover",
        "input": ({ context, event }) => {
          assertEvent(event, 'move')

          if (event.target == 'home') {
            return { ...context, "target": event.target };
          }

          return {
            ...context,
            "target": event.target,
            "x": event.x,
            "y": event.y,
          }
        },
        "onDone": {
          "target": "ready"
        },
        "onError": {
          "target": "displayingMoveError",
          "actions": {
            "type": "assignError",
            "params": ({ event }) => ({ error: event.error as Error })
          }
        },
        "src": "moveHandler"
      }
    },
    "picking": {
      entry: { type: "styleMove", params: { state: 'moving' } },
      "invoke": {
        "id": "picker",
        "input": ({ context }) => ({ ...context, moveHeight }),
        "onDone": {
          "target": "ready"
        },
        "onError": {
          "target": "displayingPickerError",
          "actions": {
            "type": "assignError",
            "params": ({ event }) => ({ error: event.error as Error })
          }
        },
        "src": "dropHandler"
      }
    },
    "displayingMoveError": {
      entry: { type: "styleMove", params: { state: 'error' } },
      "after": {
        "3000": {
          "target": "ready",
          "actions": { type: "clearError" }
        }
      }
    },
    "displayingPickerError": {
      entry: { type: "styleMove", params: { state: 'error' } },
      "after": {
        "2000": {
          "target": "ready",
          "actions": { type: "clearError" }
        }
      }
    }
  }
})

//Creating a delay function for timing 
function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time));
}

async function home(motionClient: MotionClient, armClient: ArmClient) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }

  // home position - where ball should be dropped and each game starts
  let home_pose: SDK.Pose = {
    x: 390,
    y: 10,
    z: moveHeight,
    theta: 0,
    oX: 0,
    oY: 0,
    oZ: -1,
  };

  let home_pose_in_frame: SDK.PoseInFrame = {
    referenceFrame: "world",
    pose: home_pose
  }

  await motionClient.move(home_pose_in_frame, armName, myWorldState, constraints)
}

async function moveToQuadrant(motionClient: MotionClient, armClient: ArmClient, x: number, y: number) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }
  let pose: SDK.Pose = {
    x: 390,
    y: 105,
    z: moveHeight,
    theta: 0,
    oX: 0,
    oY: 0,
    oZ: -1,
  }

  if (useQuandrantMath) {
    let xTarget = (quadrantSize * x)
    let yTarget = (quadrantSize * y)
    let yOffset = 0
    let xOffset = 0
    if (xTarget < 0) {
      yOffset = 0 - offset
    } else if (xTarget === 0) {
      // do nothing
    } else {
      xOffset = 0 - offset
      yOffset = offset
    }
    pose = {
      x: xTarget + xOffset,
      y: yTarget + yOffset,
      z: moveHeight,
      theta: 0,
      oX: 0,
      oY: 0,
      oZ: -1,
    };
  } else {
    let gridLookup = x + ',' + y
    pose.x = gridPositions[gridLookup].x
    pose.y = gridPositions[gridLookup].y
  }

  console.log(x, y, pose)

  let new_pose_in_frame: SDK.PoseInFrame = {
    referenceFrame: "world",
    pose: pose
  }

  try {
    await motionClient.move(new_pose_in_frame, armName, myWorldState, constraints)
  } finally {
    // homebutton().disabled = false;
  }
}

async function inPlaneMove(motionClient: MotionClient, armClient: ArmClient, xDist: number, yDist: number) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }

  // Get current position of the arm 
  let currentPosition = await motionClient.getPose(armName, 'world', [])
  console.log('current position:' + JSON.stringify(currentPosition))

  // Calculate new position
  let pose: Pose = {
    x: currentPosition.pose!.x + xDist,
    y: currentPosition.pose!.y + yDist,
    z: currentPosition.pose!.z,
    theta: 0,
    oX: 0,
    oY: 0,
    oZ: -1
  };
  let pif: SDK.PoseInFrame = {
    referenceFrame: "world",
    pose: pose
  }

  // Move to new position
  console.log('moving to:' + JSON.stringify(pif))
  await motionClient.move(pif, armName, myWorldState, constraints)
}

async function zMove(motionClient: MotionClient, armClient: ArmClient, zHeight: number) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }

  // Get current position of the arm 
  let currentPosition = await motionClient.getPose(armName, 'world', [])
  console.log('current position:' + JSON.stringify(currentPosition))

  let pose: Pose = {
    x: currentPosition.pose!.x,
    y: currentPosition.pose!.y,
    z: zHeight,
    theta: 0,
    oX: 0,
    oY: 0,
    oZ: -1
  };
  let pif: SDK.PoseInFrame = {
    referenceFrame: "world",
    pose: pose
  }

  // Move to new position
  console.log('moving in Z direction to:' + JSON.stringify(pif))
  await motionClient.move(pif, armName, myWorldState, constraints)
}

async function grab(boardClient: BoardClient, gripperClient: GripperClient | null) {
  console.log(`i'm grabbin`);

  if (gripperClient === null) {
    console.log(await boardClient.getGPIO(grabberPin));
    await boardClient.setGPIO(grabberPin, true);
  } else {
    await gripperClient.grab();
  }
}

async function release(boardClient: BoardClient, gripperClient: GripperClient | null) {
  console.log('i let go now');

  if (gripperClient === null) {
    console.log(await boardClient.getGPIO(grabberPin));
    await boardClient.setGPIO(grabberPin, false);
  } else {
    await gripperClient.open();
  }

  await delay(1000);
}

function styleMove(_, params: { state: 'moving' | 'ready' | 'error' }) {
  const container = document.getElementById('grid-container')
  if (container == null) return;

  container.dataset.state = params.state;

  if (params.state === 'moving') {
    // randomly animate
    if (useAnimations) {
      let rand = Math.floor(Math.random() * 50) + 1
      if (rand < 20) {
        document.getElementById('animate-left').style.backgroundImage = "url(images/animate/animate" + rand + ".webp)"
        document.getElementById('animate-right').style.backgroundImage = "url(images/animate/animate" + rand + ".webp)"
      }
    }
  }
  if (params.state === 'ready') {
    document.getElementById('animate-left').style.backgroundImage = ''
    document.getElementById('animate-right').style.backgroundImage = ''
  }
}

async function main() {
  const clawMachineActor = createActor(clawMachine.provide({
    actions: {
      styleMove
    }
  }))

  clawMachineActor.subscribe(snapshot => {
    console.log(`Current state: ${snapshot.value}`)
  })

  document.body.addEventListener('pointerdown', (event) => {
    if (event.target instanceof HTMLElement && "event" in event.target.dataset) {
      const { event: machineEvent, target, x = "0", y = "0" } = event.target.dataset;

      if (machineEvent === "move") {
        if (target === "home") {
          clawMachineActor.send({ type: machineEvent, target })
        }
        if (target === "planar" || target === "quadrant") {
          clawMachineActor.send({ type: machineEvent, target, x: parseInt(x, 10), y: parseInt(y, 10) })
        }
      }
      if (machineEvent === "dropAndHome") clawMachineActor.send({ type: machineEvent })
    }
  })

  clawMachineActor.start();

  clawMachineActor.send({ type: 'connect' })
}

main();

// disable user zooming
document.addEventListener('touchmove', function(event) {
  if (event.scale !== 1) { event.preventDefault(); }
}, { passive: false });

var lastTouchEnd = 0;
document.addEventListener('touchend', function(event) {
  var now = (new Date()).getTime();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, false);
