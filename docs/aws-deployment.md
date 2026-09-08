# AWS deployment runbook

## Current status

The application, container definitions, CloudFormation templates, and GitLab pipeline are authored locally. They are not yet evidence of a successful AWS deployment or remote CI run. Local AWS credentials and Docker are unavailable in the build environment. Complete the steps below with the account owner and record actual outputs.

## Review the concrete resources first

`deploy/aws-stack.yaml` creates one Amazon Linux 2023 `t3.small` EC2 instance, 20 GiB encrypted gp3 root disk, a private encrypted/versioned S3 bucket, an instance role/profile, and a security group with only ports 80/443. There is no NAT gateway, load balancer, RDS instance, or paid domain purchase. EC2 uses standard CPU credits to avoid unlimited-mode credit charges. Administration uses Systems Manager rather than SSH.

The template needs an existing VPC and public subnet with Internet Gateway routing. It does not create or change the account's network. The S3 bucket is retained on stack deletion to protect uploads. The EC2 root disk is deleted with its instance: back up PostgreSQL before replacing or deleting the instance.

At the reviewed AWS US East pricing, an always-running small host, IPv4 address and 20 GiB gp3 disk have a base cost of approximately **$21/month** at 730 hours, before S3, transfer, logs, snapshots, domain costs, tax, or account credits. Treat **$25/month as a planning allowance, not a hard spending cap**. Verify your region and actual rates in the AWS calculator before launch. AWS Budgets alerts are notifications, not automatic spending limits.

Sources reviewed: [EC2 T3 pricing](https://aws.amazon.com/ec2/instance-types/t3/), [IPv4 pricing](https://aws.amazon.com/vpc/pricing/), [EBS pricing](https://aws.amazon.com/ebs/pricing/).

## First deployment

1. Confirm the AWS account, region, cost allowance, and a subdomain you control. Obtain approval before provisioning paid resources and security-sensitive IAM access. Do not send access keys in chat. Use AWS sign-in/CloudShell or a locally configured short-lived profile.
2. Create/import the project in GitLab with `main` as the default branch. Push the local source branch to remote `main`. Run the pipeline to test PostgreSQL, build the frontend, and publish both commit-tagged containers. Docker-in-Docker requires a runner configured to allow it.
3. Review and launch `deploy/aws-stack.yaml` through CloudFormation using the intended VPC/subnet. Record the instance, bucket and public IP outputs. CloudFormation completion means resources exist; separately inspect `/var/log/cloud-init-output.log` and `docker compose version` because the template does not include a bootstrap-success signal.
4. Connect through Systems Manager. Transfer the source bundle to `/opt/datadock` using an authorized private S3 object or your repository. Do not put registry or AWS credentials in a public URL or source file. If the registry is private, log Docker in on the host using a read-registry-only deploy token through `--password-stdin`.
5. Copy `.env.production.example` to `/opt/datadock/.env.production`, set owner-only file permissions, a generated hexadecimal PostgreSQL password, the bucket/region outputs, and the exact API/WEB image SHA tags. AWS credentials come from the instance role; no AWS keys belong in this file.
6. Run `docker compose --env-file .env.production -f compose.production.yml up -d --wait`. Verify `curl --fail http://127.0.0.1:8080/api/health`. Only the loopback address exposes the container web port. Container metadata access requires the configured IMDSv2 hop limit of 2; verify an actual sample upload writes an object to the intended private bucket.
7. Point your subdomain's A record to the instance IP. The automatically assigned address can change after stopping/starting EC2. Update DNS after a change, or explicitly add an Elastic IP after reviewing its lifecycle.
8. Replace the example hostname in `deploy/nginx-host.conf.example`, install it at `/etc/nginx/conf.d/datadock.conf`, check `nginx -t`, then start Nginx. On hosts with SELinux enforcing, authorize the Nginx reverse proxy's outbound connection with the appropriate policy (`httpd_can_network_connect`) rather than disabling SELinux. Certbot's Nginx flow issues the certificate and adds HTTPS redirection. Accept certificate service terms yourself when prompted. Test automatic renewal with `certbot renew --dry-run` and verify its timer/cron schedule.
9. Open the HTTPS URL, load the sample, clean/export it, and reload history. Confirm `Secure`, `HttpOnly`, and `SameSite=Strict` cookie flags and that a second browser cannot access the first browser's report. Do not use HTTP for the production session; production cookies intentionally require HTTPS.
10. Add the real demo URL and repository to the portfolio only after these checks pass. Capture a successful pipeline, health response, and recovery exercise as evidence.

## GitLab deployment setup

The optional `deploy/gitlab-oidc-role.yaml` accepts an existing IAM OIDC provider for `https://gitlab.com` with audience `sts.amazonaws.com`. Review provider creation with the account owner. The role trusts the exact project's `main` branch and permits SSM command execution only on the selected DataDock instance plus invocation status reads. Protect the branch and production environment: SSM command capability is administrative access to that host.

Set protected GitLab variables `AWS_ROLE_ARN`, `AWS_REGION`, `EC2_INSTANCE_ID`, and `PRODUCTION_URL`. The job's `id_tokens` supplies a short-lived token; no long-lived AWS access keys are needed. The manual deployment job waits for tests and published images. `release.sh` updates both image tags, waits for container health and the API, and attempts to restore the prior environment/images if a step fails. Inspect SSM status before retrying a timed-out deployment.

The first deployment needs a valid `.env.production`. Keep Compose files and release scripts on the host aligned with the version you deploy. Version 1 has no schema upgrades; add migrations and a schema-compatible rollback plan before introducing them.

## Backup, restore, and stop

- Back up PostgreSQL with `pg_dump` from the DB container, compress it and store it privately in S3 with an explicit retention policy. Original CSV objects alone do not restore report history or session ownership mappings.
- Test restoration into a separate database/volume before considering a backup reliable. Record the exact image versions, dump timestamp, and restored row counts. Do not overwrite a live database as a test.
- Inspect `docker compose logs --tail=100 api web`, Nginx logs and Systems Manager commands when troubleshooting. Redact cookies, credentials, data rows and user files from shared logs.
- `docker compose down` preserves named volumes. Never use `down -v` unless deliberately deleting data with approval.
- Stopping EC2 reduces compute costs but EBS, retained S3 versions and some address resources can continue charging. Removing the stack deletes the host/root disk but intentionally retains the S3 bucket. Review backups and explicit deletion approval before cleanup.
