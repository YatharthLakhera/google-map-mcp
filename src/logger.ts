export const Logger = {
  log: (...args: any[]) => {
    process.stderr.write("[INFO] " + args.map(String).join(" ") + "\n");
  },
  error: (...args: any[]) => {
    process.stderr.write("[ERROR] " + args.map(String).join(" ") + "\n");
  },
};
