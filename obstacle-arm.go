package main

import (
	"context"
	"flag"
	"fmt"

	"github.com/edaniels/golog"
	"github.com/golang/geo/r3"
	"github.com/viamrobotics/visualization"
	"go.viam.com/rdk/components/arm"
	"go.viam.com/rdk/components/arm/xarm"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/robot/client"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/rdk/utils"
	"go.viam.com/utils/rpc"
)

func main() {
	ctx := context.Background()
	robot := connect(ctx)
	defer robot.Close(context.Background())

	worldState := getWorldState()

	// get arm from robot
	xArm, err := arm.FromRobot(robot, "myArm")
	if err != nil {
		fmt.Println(err)
	}

	//visualize worldstate + robot
	model, _ := xarm.MakeModelFrame("test", "xArm6")
	jPos, _ := xArm.JointPositions(ctx, nil)
	conv1 := referenceframe.JointPositionsToRadians(jPos)
	conv2 := referenceframe.FloatsToInputs(conv1)
	fs := referenceframe.NewEmptyFrameSystem("")
	fs.AddFrame(model, fs.World())
	inputs := referenceframe.StartPositions(fs)
	inputs[model.Name()] = conv2
	visualization.VisualizeScene(fs, inputs, worldState)

	// close the connection
	robot.Close(ctx)
}

func connect(ctx context.Context) *client.RobotClient {
	address := flag.String("address", "", "robot address found on app.viam.com")
	payload := flag.String("payload", "", "robot payload found on app.viam.com")
	flag.Parse()
	
	logger := golog.NewDevelopmentLogger("client")
	robot, err := client.New(
		ctx,
		*address,
		logger,
		client.WithDialOptions(rpc.WithCredentials(rpc.Credentials{
			Type:    utils.CredentialsTypeRobotLocationSecret,
			Payload: *payload,
		})),
	)
	if err != nil {
		logger.Fatal(err)
	}
	logger.Infof("Resources: %q", robot.ResourceNames())
	return robot
}

func getWorldState() *referenceframe.WorldState {
	obstacles := []spatialmath.Geometry{}

	//front wall
	frontWallName := "frontWall"
	frontWallDims := r3.Vector{X: 15.0, Y: 2000, Z: 1000.0}
	frontWallPose := spatialmath.NewPose(
		r3.Vector{X: 560.0, Y: 0.0, Z: 0.0},
		&spatialmath.OrientationVectorDegrees{OX: 0.0, OY: 0.0, OZ: 1.0, Theta: 15.0},
	)
	frontWallObj, _ := spatialmath.NewBox(frontWallPose, frontWallDims, frontWallName)
	obstacles = append(obstacles, frontWallObj)

	//back wall
	backWallName := "backWall"
	backWallDims := r3.Vector{X: 15.0, Y: 2000, Z: 1000.0}
	backWallPose := spatialmath.NewPose(
		r3.Vector{X: -560.0, Y: 0.0, Z: 0.0},
		&spatialmath.OrientationVectorDegrees{OX: 0.0, OY: 0.0, OZ: 1.0, Theta: 15.0},
	)
	backWallObj, _ := spatialmath.NewBox(backWallPose, backWallDims, backWallName)
	obstacles = append(obstacles, backWallObj)

	//left wall
	leftWallName := "leftWall"
	leftWallDims := r3.Vector{X: 15.0, Y: 2000, Z: 1000.0}
	leftWallPose := spatialmath.NewPose(
		r3.Vector{X: 0.0, Y: -600.0, Z: 0.0},
		&spatialmath.OrientationVectorDegrees{OX: 0.0, OY: 0.0, OZ: 1.0, Theta: 105.0},
	)
	leftWallObj, _ := spatialmath.NewBox(leftWallPose, leftWallDims, leftWallName)
	obstacles = append(obstacles, leftWallObj)

	//right wall
	rightWallName := "rightWall"
	rightWallDims := r3.Vector{X: 15.0, Y: 2000, Z: 1000.0}
	rightWallPose := spatialmath.NewPose(
		r3.Vector{X: 0.0, Y: 600.0, Z: 0.0},
		&spatialmath.OrientationVectorDegrees{OX: 0.0, OY: 0.0, OZ: 1.0, Theta: 105.0},
	)
	rightWallObj, _ := spatialmath.NewBox(rightWallPose, rightWallDims, rightWallName)
	obstacles = append(obstacles, rightWallObj)

	//hole obstacle
	holeName := "hole"
	holeDims := r3.Vector{X: 250.0, Y: 400, Z: 400.0}
	holePose := spatialmath.NewPose(
		r3.Vector{X: 470.0, Y: 125.0, Z: 0.0},
		&spatialmath.OrientationVectorDegrees{OX: 0.0, OY: 0.0, OZ: 1.0, Theta: 15.0},
	)
	holeObj, _ := spatialmath.NewBox(holePose, holeDims, holeName)
	obstacles = append(obstacles, holeObj)

	//floor obstacle
	floorName := "floor"
	floorDims := r3.Vector{X: 2000.0, Y: 2000, Z: 30.}
	floorPose := spatialmath.NewPose(
		//pose
		r3.Vector{X: 0.0, Y: 0, Z: 0.0},
		//orientation
		&spatialmath.OrientationVectorDegrees{OX: 0.0, OY: 0.0, OZ: 1.0, Theta: 105.0},
	)
	floorObj, _ := spatialmath.NewBox(floorPose, floorDims, floorName)
	obstacles = append(obstacles, floorObj)

	// add obstacles to worldstate
	obstaclesInFrame := referenceframe.NewGeometriesInFrame(referenceframe.World, obstacles)
	worldState, _ := referenceframe.NewWorldState([]*referenceframe.GeometriesInFrame{obstaclesInFrame}, nil)
	return worldState
}
