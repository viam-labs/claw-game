import * as Sentry from '@sentry/browser';
import { Client, GripperClient, BoardClient, MotionClient, ArmClient, createRobotClient } from '@viamrobotics/sdk';
import type { Credential, ResourceName, Constraints, Pose } from '@viamrobotics/sdk';
import * as SDK from '@viamrobotics/sdk';
import { parse as parseCookies } from 'cookie-es';
import { setup, fromPromise, assign, assertEvent, createActor } from 'xstate'
import obstacles from '../obstacles-office.json';

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
    geometryType: {
      case: "box",
      value: {
        dimsMm: {
          x: obs.x,
          y: obs.y,
          z: obs.z,
        }
      }
    },
  }
  geomList.push(geom);
}

const myObstaclesInFrame: SDK.GeometriesInFrame = {
  referenceFrame: "world",
  geometries: geomList,
}

const myWorldState: SDK.WorldState = {
  obstacles: [myObstaclesInFrame],
  transforms: [],
}

const cookieStore = parseCookies(document.cookie)

const robotAPIKey = cookieStore['api-key']
const robotAPIKeyID = cookieStore['api-key-id']
const robotHost = cookieStore['host']

const grabberPin = '7'
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
  orientationConstraint: [
    { orientationToleranceDegs: 5 },
  ],
  linearConstraint: [],
  collisionSpecification: [],
};

const getArmName = (name: string): ResourceName => ({
  namespace: 'rdk',
  type: 'component',
  subtype: 'arm',
  name,
})

type ClientNameParams = Record<'boardClientName' | 'armClientName' | 'motionClientName' | 'gripperClientName', string>

type ClawMachineContext = ClientNameParams & {
  machineClient: Client,
  motionClient: MotionClient,
  boardClient: BoardClient,
  armClient: ArmClient,
  gripperClient: GripperClient,
  pickingHeight: number,
  error: Error | null,
}

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
    "events": {} as ClawMachineEvent,
    "input": {} as ClientNameParams & { pickingHeight: number },
  },
  "actions": {
    "assignClients": assign({
      motionClient: ({ context }) =>
        new MotionClient(context.machineClient, context.motionClientName),

      boardClient: ({ context }) =>
        new BoardClient(context.machineClient, context.boardClientName),

      armClient: ({ context }) =>
        new ArmClient(context.machineClient, context.armClientName),

      gripperClient: ({ context }) =>
        new GripperClient(context.machineClient, context.gripperClientName),
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
    "styleMove": (_, _params: { state: 'moving' | 'ready' | 'error' }) => { },
    "logError": (_, params: { error: Error }) => {
      console.error(params.error)
    }
  },
  "actors": {
    "createRobotClient": fromPromise<Client, { apiKey: string, apiKeyId: string, locationAddress: string }>(
      async ({ input }) => {
        const credentials: Credential = {
          type: "api-key",
          payload: input.apiKey,
          authEntity: input.apiKeyId,
        }

        //This is the host address of the main part of your robot.
        const host = input.locationAddress

        return createRobotClient({
          host,
          credentials,
          signalingAddress:
            "https://app.viam.com:443",
        })
      },
    ),
    "moveHandler": fromPromise<void, MoveInput>(async ({ input }) => {
      if (input.target == "quadrant") {
        await moveToQuadrant(input.motionClient, input.armClient, input.x, input.y, input.armClientName)
      }
      if (input.target == "planar") {
        await inPlaneMove(input.motionClient, input.armClient, input.x, input.y, input.armClientName)
      }
      if (input.target == "home") {
        await home(input.motionClient, input.armClient, input.armClientName)
      }
    }),
    "dropHandler": fromPromise<void, ClawMachineContext & { moveHeight: number }>(async ({ input }) => {
      await zMove(input.motionClient, input.armClient, input.pickingHeight, input.armClientName)
      await grab(input.boardClient, input.gripperClient)
      await delay(1000)
      await zMove(input.motionClient, input.armClient, input.moveHeight, input.armClientName)
      await home(input.motionClient, input.armClient, input.armClientName)
      await delay(1000)
      await release(input.boardClient, input.gripperClient)
    })
  },
}).createMachine({
  "context": ({ input }) => {
    return {
      error: null,
      ...input
    } as ClawMachineContext
  },
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
          "locationAddress": robotHost
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
          "actions": [{
            "type": "assignError",
            "params": ({ event }) => ({ error: event.error as Error })
          }, {
            "type": "logError",
            "params": ({ event }) => ({ error: event.error as Error })
          }]
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
          "actions": [{
            "type": "assignError",
            "params": ({ event }) => ({ error: event.error as Error })
          }, {
            "type": "logError",
            "params": ({ event }) => ({ error: event.error as Error })
          }]
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
          "actions": [{
            "type": "assignError",
            "params": ({ event }) => ({ error: event.error as Error })
          }, {
            "type": "logError",
            "params": ({ event }) => ({ error: event.error as Error })
          }]
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

async function home(motionClient: MotionClient, armClient: ArmClient, armName: string) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }

  // home position - where ball should be dropped and each game starts
  let home_pose: SDK.Pose = {
    x: 310,
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

  await motionClient.move(home_pose_in_frame, getArmName(armName), myWorldState, constraints)
}

async function moveToQuadrant(motionClient: MotionClient, armClient: ArmClient, x: number, y: number, armName: string) {
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

  let new_pose_in_frame: SDK.PoseInFrame = {
    referenceFrame: "world",
    pose: pose
  }

  try {
    await motionClient.move(new_pose_in_frame, getArmName(armName), myWorldState, constraints)
  } finally {
    // homebutton().disabled = false;
  }
}

async function inPlaneMove(motionClient: MotionClient, armClient: ArmClient, xDist: number, yDist: number, armName: string) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }

  // Get current position of the arm 
  let currentPosition = await motionClient.getPose(getArmName(armName), 'world', [])
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
  await motionClient.move(pif, getArmName(armName), myWorldState, constraints)
}

async function zMove(motionClient: MotionClient, armClient: ArmClient, zHeight: number, armName: string) {
  if (ignoreInterrupts && await armClient.isMoving()) { return }

  // Get current position of the arm 
  let currentPosition = await motionClient.getPose(getArmName(armName), 'world', [])
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
  await motionClient.move(pif, getArmName(armName), myWorldState, constraints)
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
  const host = window.location.host
  const config = await fetch(`http://${host}/config.json`).then(res => res.json())
  const armClientName = config.attributes.arm as string
  const boardClientName = config.attributes.board as string
  const gripperClientName = config.attributes.gripper as string
  const motionClientName = config.attributes.motion as string
  const sentryDSN = config.attributes.sentry as string
  const pickingHeight = (config.attributes.pickingHeight ?? 240) as number

  if (sentryDSN) {
    Sentry.init({
      dsn: sentryDSN,
    })
  }

  const errorActions = sentryDSN ? {
    logError: (_, params: { error: Error }) => {
      Sentry.captureException(params.error);
    }
  } : {};
  const clawMachineActor = createActor(clawMachine.provide({
    actions: {
      styleMove,
      ...errorActions,
    }
  }), {
    input: {
      armClientName,
      boardClientName,
      gripperClientName,
      motionClientName,
      pickingHeight
    }
  })

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

main().catch(console.error);

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

