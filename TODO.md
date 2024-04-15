## Database

- [x] populate DB with words
  - [x] read words from file
  - [ ] assign word points
  - [ ] assign word language
  - [ ] each word should keep track of how many times it's been played (per instance)
- [ ] Schema for players
  - [ ] ID, Score, Guess count, Fail count?
- [ ] Schema for instances
  - [ ] Instance ID -> webhook URL param
  - [ ] Word language
  - [ ]

## Integrations

- [x] Create Slack app
  - [x] Handle URL verification
  - [x] Read message events
  - [ ] Store OAUTH2 tokens for each workspace?
  - [ ] Send messages to channel

## Game

- [ ] Instances
- [ ] Port game functions
  - [ ] NewRound
  - [ ] Guess
  - [ ] Hint

## Game rules

- [ ] Rethink economy - buying hints should have a meaningful cost?
