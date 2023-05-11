import asyncio

from viam.robot.client import RobotClient
from viam.rpc.dial import Credentials, DialOptions
from viam.components.arm import Arm
from viam.components.gripper import Gripper


async def connect():
    creds = Credentials(
        type='robot-location-secret',
        payload='t9hacog4ff66yjh4a00vaprrvkpq3ltwf3b3red7su4philq')
    opts = RobotClient.Options(
        refresh_interval=0,
        dial_options=DialOptions(credentials=creds)
    )
    return await RobotClient.at_address('planning.urykdsecy6.viam.cloud', opts)

async def main():
    robot = await connect()

    print('Resources:')
    print(robot.resource_names)
    
    # myArm
    my_arm = Arm.from_robot(robot, "myArm")
    my_arm_return_value = await my_arm.get_end_position()
    print(f"myArm get_end_position return value: {my_arm_return_value}")
    
    # gripper
    gripper = Gripper.from_robot(robot, "gripper")
    gripper_return_value = await gripper.is_moving()
    print(f"gripper is_moving return value: {gripper_return_value}")
    

    # Don't forget to close the robot when you're done!
    await robot.close()

if __name__ == '__main__':
    asyncio.run(main())

