# TheStatsAndStacks — Daily Pipeline Scheduling Guide

This guide details how to resolve the delay/randomness in receiving daily prompts by establishing a reliable trigger schedule.

## The Problem: Why GitHub Actions Cron is Delayed
GitHub Actions' native `on: schedule` cron triggers are executed on a best-effort, shared queue. During peak hours, GitHub Actions can delay cron workflows by **30 minutes to over 2 hours**. 

To receive prompts precisely on time, you must trigger the pipeline via **GitHub Workflow Dispatch (API)**, which bypasses the cron queue and runs immediately (within seconds).

---

## Option 1: Cloud Scheduler via cron-job.org (Recommended)
This method keeps the execution in the cloud (no local resources needed, your Mac does not need to be awake 24/7) and guarantees execution within seconds of the scheduled times.

### Step 1: Generate a GitHub Personal Access Token (PAT)
1. Go to your GitHub account: **Settings** -> **Developer Settings** -> **Personal Access Tokens** -> **Tokens (classic)**.
2. Click **Generate new token (classic)**.
3. Set the Note to `thestatsandstacks-scheduler` and expiration to No Expiration (or a time of your choice).
4. Select the **`actions`** scope (specifically `actions:write` which enables triggering workflows).
5. Click **Generate Token** and copy the token value safely.

### Step 2: Create a cron-job.org Account
1. Go to [cron-job.org](https://cron-job.org/) and sign up for a free account.
2. Go to the dashboard.

### Step 3: Create 6 Cron Jobs (One for each Slot)
For each of the 6 slots, create a separate cron job with the following configuration:

1. **Title**: `TheStatsAndStacks - Slot X` (replace `X` with slot number `1`, `2`, `3`, `4`, `5`, or `6`)
2. **URL**: `https://api.github.com/repos/MyankInsan/thestatsandstacks/actions/workflows/daily-post.yml/dispatches`
3. **Request Method**: `POST`
4. **Headers**:
   - `Authorization`: `Bearer <YOUR_GITHUB_PAT>`
   - `Accept`: `application/vnd.github+json`
   - `X-GitHub-Api-Version`: `2022-11-28`
   - `User-Agent`: `thestatsandstacks-scheduler`
5. **Request Body** (choose custom JSON body):
   ```json
   {
     "ref": "main",
     "inputs": {
       "slot_override": "X"
     }
   }
   ```
   *(Replace `X` in `"slot_override": "X"` with the slot index: `"1"`, `"2"`, `"3"`, `"4"`, `"5"`, or `"6"`)*

6. **Schedule**:
   Configure the trigger time precisely (using America/Vancouver timezone):
   - **Slot 1**: Daily at **07:00**
   - **Slot 2**: Daily at **09:00**
   - **Slot 3**: Daily at **11:00**
   - **Slot 4**: Daily at **13:00**
   - **Slot 5**: Daily at **14:00**
   - **Slot 6**: Daily at **15:00**

Save the cron jobs. They will now trigger the workflow instantly on time.

---

## Option 2: Local macOS Cron (Alternative)
If you prefer running the pipeline locally on your Mac, you can configure macOS `cron` to run it. Note that your Mac **must be powered on and awake** at the target times.

### Step 1: Edit your local Crontab
Open a terminal and run:
```bash
crontab -e
```

### Step 2: Add the cron entries
Add the following lines (adjusting `/Users/myank/Desktop/thestatsandstacks` to your actual workspace folder if different). This runs the script directly with the correct slot configuration and logs the results to `cron.log`:

```cron
# Slot 1 - 07:00 AM
0 7 * * * cd /Users/myank/Desktop/thestatsandstacks/platform && /usr/local/bin/node -r tsx/register run-daily.ts >> cron.log 2>&1

# Slot 2 - 09:00 AM
0 9 * * * cd /Users/myank/Desktop/thestatsandstacks/platform && /usr/local/bin/node -r tsx/register run-daily.ts >> cron.log 2>&1

# Slot 3 - 11:00 AM
0 11 * * * cd /Users/myank/Desktop/thestatsandstacks/platform && /usr/local/bin/node -r tsx/register run-daily.ts >> cron.log 2>&1

# Slot 4 - 01:00 PM (13:00)
0 13 * * * cd /Users/myank/Desktop/thestatsandstacks/platform && /usr/local/bin/node -r tsx/register run-daily.ts >> cron.log 2>&1

# Slot 5 - 02:00 PM (14:00)
0 14 * * * cd /Users/myank/Desktop/thestatsandstacks/platform && /usr/local/bin/node -r tsx/register run-daily.ts >> cron.log 2>&1

# Slot 6 - 03:00 PM (15:00)
0 15 * * * cd /Users/myank/Desktop/thestatsandstacks/platform && /usr/local/bin/node -r tsx/register run-daily.ts >> cron.log 2>&1
```

*Note: Ensure the path to the `node` binary is correct (run `which node` to verify). If you are using local environment variables, you may need to load them or define them directly in the cron commands.*
