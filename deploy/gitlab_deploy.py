"""Use short-lived GitLab OIDC credentials and SSM; no SSH keys or AWS keys in CI."""
import os
import re
import time

import boto3

required = ["AWS_ID_TOKEN", "AWS_ROLE_ARN", "AWS_REGION", "EC2_INSTANCE_ID", "CI_COMMIT_SHA", "CI_REGISTRY_IMAGE"]
missing = [key for key in required if not os.environ.get(key)]
if missing:
    raise SystemExit("Configure protected CI variables: " + ", ".join(missing))
sha = os.environ["CI_COMMIT_SHA"]
image = os.environ["CI_REGISTRY_IMAGE"]
if not re.fullmatch(r"[a-f0-9]{40}", sha) or not re.fullmatch(r"[a-zA-Z0-9._/-]+", image):
    raise SystemExit("Invalid immutable release reference")
credentials = boto3.client("sts", region_name=os.environ["AWS_REGION"]).assume_role_with_web_identity(
    RoleArn=os.environ["AWS_ROLE_ARN"], RoleSessionName="DataDockDeploy",
    WebIdentityToken=os.environ["AWS_ID_TOKEN"], DurationSeconds=900,
)["Credentials"]
ssm = boto3.client("ssm", region_name=os.environ["AWS_REGION"],
    aws_access_key_id=credentials["AccessKeyId"], aws_secret_access_key=credentials["SecretAccessKey"],
    aws_session_token=credentials["SessionToken"])
command = ssm.send_command(InstanceIds=[os.environ["EC2_INSTANCE_ID"]], DocumentName="AWS-RunShellScript",
    Parameters={"commands": [f"cd /opt/datadock && bash deploy/release.sh {image} {sha}"]}, TimeoutSeconds=900)
command_id = command["Command"]["CommandId"]
for _ in range(120):
    time.sleep(5)
    try:
        invocation = ssm.get_command_invocation(CommandId=command_id, InstanceId=os.environ["EC2_INSTANCE_ID"])
    except ssm.exceptions.InvocationDoesNotExist:
        continue
    if invocation["Status"] == "Success":
        print(f"Release {sha[:12]} passed its health check.")
        break
    if invocation["Status"] in {"Failed", "Cancelled", "TimedOut"}:
        raise SystemExit("Deployment failed. Review the command in AWS Systems Manager; the release script attempts rollback.")
else:
    raise SystemExit("Deployment status timed out. Inspect AWS Systems Manager before retrying.")
