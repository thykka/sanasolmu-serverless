# Sanasolmu serverlessless

A word guessing game for your Slack channel.

## Installation (end users)

App is not yet published. Await for further instructions.

## Development

### Installation

1. Clone the repo

2. Choose the Node.js version, e.g. with [nvm](https://github.com/nvm-sh/nvm):

```sh
nvm use
```

3. Install dependencies:

```sh
npm i
```

4. Fill out environment variables:

```sh
cp .env.example .env
nano .env
```

### Usage

Run the app locally at the root of the repository:

```bash
npm run start
```

The `main` branch is protected. Any changes should be made via a pull request. PRs must be approved by project owners. A successful merge to `main` will trigger a production build and deployment.
