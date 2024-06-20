## Database

- Words

  - [x] read words from file
  - [ ] assign word points
  - [ ] assign word language

- Players

  - [ ] Slack ID, Score, Guess count, Fail count?
  - [ ] Cache [Slack ID]: nickname

- [ ] Instances
  - [ ] Word language
  - [ ] List of used words

## Integrations

- Slack app
  - [x] Handle URL verification
  - [x] Read message events
  - [x] Send messages to channel
  - [x] React to messages
  - [x] Chat commands with arguments
  - [x] Observe single word messages
  - [ ] Store [OAUTH2 tokens](https://api.slack.com/authentication/oauth-v2) for each workspace -> [@slack/web-api](https://slack.dev/node-slack-sdk/web-api)

## Game

- Instances (per channel)
- Port game functions
  - [ ] NewRound
  - [ ] Guess
  - [ ] Hint
- Implement new functions
  - [ ] Guess stats
  - [ ] Player stats
  - [ ] Words stats

## Game rules

- [ ] Rethink economy - buying hints should have a meaningful cost?

https://app.slack.com/client/T06V1HD2ZS4/C06U9S72Y13
https://slack.dev/node-slack-sdk/web-api#new-way
