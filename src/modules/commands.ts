import type { WebClient } from "@slack/web-api";

type Command = {
  type: string;
  args: string[];
};

type CommandProcessor = {
  fn: (
    client: WebClient,
    command: Command,
    channel: string,
    user: string,
  ) => Promise<void>;
};
type CommandProcessors = Record<string, CommandProcessor>;

export const Commands: CommandProcessors = {
  hello: {
    fn: async (client, command, channel, user) => {
      const response = await client.users.info({ user });
      const { id, name, real_name, team_id, deleted } = response?.user;
      await client.chat.postMessage({
        channel,
        text: `Hello, ${name}!`,
        attachments: null,
      });
    },
  },
  none: {
    fn: async (client, command, channel, user) => {
      console.log("(no command)", command.args);
    },
  },
} as const;

export const addCommand = (commandName: string, command: Command) => {};

export const processCommand = async (
  client: WebClient,
  command: Command,
  channel,
  user,
): Promise<void> => {
  const foundCommand = Commands[command.type];
  if (!foundCommand) {
    console.warn("Unknown command type", command.type);
    return;
  }
  foundCommand.fn(client, command, channel, user);
};

export const parseCommand = (text: string): Command | null => {
  const sanitizedText = text.trim();
  if (!sanitizedText.length) return null;

  const words = sanitizedText.split(" ");
  if (words.length > 1) {
    // First word is the invoked command
    const [type, ...args] = words;
    return { type, args };
  }
  return { type: "none", args: [sanitizedText] };
};
