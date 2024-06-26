import type { WebClient } from "@slack/web-api";

export const COMMAND_PREFIX = "!";

type Command = {
  type: string;
  args: string[];
};
export type CommandProcessor = {
  fn: (
    client: WebClient,
    command: Command,
    channel: string,
    user: string,
    timestamp: string,
  ) => Promise<void>;
};
type CommandProcessors = Record<string, CommandProcessor>;

// Modules can add commands into this Object using `addCommand`
// Commands are globally enabled!
export const Commands: CommandProcessors = {
  ["single word"]: {
    fn: async (client, command, channel, user) => {
      console.log("(no command)", command.args);
    },
  },
};

export const addCommand = (
  commandName: string,
  processor: CommandProcessor,
  commands = Commands,
) => {
  console.log(`Adding command "${commandName}"`);
  commands[commandName] = processor;
};

export const processCommand = async (
  client: WebClient,
  command: Command,
  channel,
  user,
  timestamp: string,
  commands = Commands,
): Promise<void> => {
  const foundCommand = commands[command.type];
  if (!foundCommand) {
    // TODO: Use proper error throwing
    console.warn("Unknown command type", command.type, Object.keys(commands));
    client.reactions.add({
      channel,
      timestamp,
      name: "thinking_face",
    });
    return;
  }
  foundCommand.fn(client, command, channel, user, timestamp);
};

export const parseCommand = (text: string): Command | null => {
  const sanitizedText = text.trim();

  // Don't act on empty text
  if (!sanitizedText.length) return null;
  const words = sanitizedText.split(" ");

  // Check if it's a prefixed command
  const [firstChar] = sanitizedText;
  if (firstChar === COMMAND_PREFIX) {
    const [trigger, ...args] = words;
    const type = trigger.slice(1);
    return { type, args };
  }

  // Check if it's a single word message
  if (words.length === 1) {
    return { type: "single word", args: [sanitizedText] };
  }

  // Ignore everything else
  return null;
};
