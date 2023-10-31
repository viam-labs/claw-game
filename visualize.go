package main

import (
	"context"
	"encoding/json"
	"flag"
	"os"

	"github.com/edaniels/golog"
	"github.com/pkg/errors"
	"github.com/viamrobotics/visualization"
	"go.viam.com/rdk/components/arm"
	"go.viam.com/rdk/components/arm/xarm"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/robot/client"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/rdk/utils"
	"go.viam.com/utils/rpc"
)

var (
	logger = golog.NewDevelopmentLogger("client")

	location = flag.String("location", "", "robot address found on app.viam.com")
	secret   = flag.String("apikey", "", "robot api key for given address found on app.viam.com")
	secret   = flag.String("apikeyid", "", "robot api key id for given address found on app.viam.com")
)

func main() {
	ctx := context.Background()
	robot := connect(ctx)
	defer robot.Close(ctx)

	logger.Infof("Resources: %q", robot.ResourceNames())

	worldState, err := getWorldState()
	if err != nil {
		logger.Fatal(err)
	}

	// get arm from robot
	xArm, err := arm.FromRobot(robot, "myArm")
	if err != nil {
		logger.Fatal(err)
	}

	//visualize worldstate + robot
	model, _ := xarm.MakeModelFrame("test", xarm.ModelName6DOF)
	jPos, _ := xArm.JointPositions(ctx, nil)
	conv1 := referenceframe.JointPositionsToRadians(jPos)
	conv2 := referenceframe.FloatsToInputs(conv1)
	fs := referenceframe.NewEmptyFrameSystem("")
	fs.AddFrame(model, fs.World())
	inputs := referenceframe.StartPositions(fs)
	inputs[model.Name()] = conv2
	visualization.VisualizeScene(fs, inputs, worldState)
}

func connect(ctx context.Context) *client.RobotClient {
	flag.Parse()
	robot, err := client.New(
		ctx,
		*location,
		logger,
		client.WithDialOptions(rpc.WithEntityCredentials(
			*apikeyid,
			rpc.Credentials{
				Type:    rpc.CredentialsTypeAPIKey,
				Payload: *apikey,
			}),
	)
	if err != nil {
		logger.Fatal(err)
	}
	return robot
}

func getWorldState() (*referenceframe.WorldState, error) {
	obstacleCfgs := []spatialmath.GeometryConfig{}
	obstacles := []spatialmath.Geometry{}
	jsonData, err := os.ReadFile("obstacles.json")
	if err != nil || len(jsonData) == 0 {
		return nil, errors.Wrap(err, "failed to read json file")
	}
	err = json.Unmarshal(jsonData, &obstacleCfgs)
	if err != nil {
		return nil, err
	}
	for _, cfg := range obstacleCfgs {
		geometry, err := cfg.ParseConfig()
		if err != nil {
			return nil, err
		}
		obstacles = append(obstacles, geometry)
	}
	return referenceframe.NewWorldState(
		[]*referenceframe.GeometriesInFrame{referenceframe.NewGeometriesInFrame(referenceframe.World, obstacles)},
		nil,
	)
}
