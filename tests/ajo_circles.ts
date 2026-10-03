import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AjoCircles } from "../target/types/ajo_circles";

describe("ajo_circles", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.AjoCircles as Program<AjoCircles>;

  it("loads the Ajo Circles program", async () => {
    if (
      program.programId.toBase58() !==
      "B7YcA9vqKUF2Gkj6Ct8AG71a3upQftd7VwPBV7qjn3cw"
    ) {
      throw new Error(
        "The loaded program id does not match the configured program"
      );
    }
  });
});
