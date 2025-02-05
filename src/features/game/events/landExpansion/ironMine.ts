import Decimal from "decimal.js-light";
import { canMine } from "features/game/expansion/lib/utils";
import cloneDeep from "lodash.clonedeep";
import { IRON_RECOVERY_TIME } from "../../lib/constants";
import { trackActivity } from "../../types/bumpkinActivity";
import { Collectibles, GameState } from "../../types/game";
import { isCollectibleActive } from "features/game/lib/collectibleBuilt";

export type LandExpansionIronMineAction = {
  type: "ironRock.mined";
  index: string;
};

type Options = {
  state: Readonly<GameState>;
  action: LandExpansionIronMineAction;
  createdAt?: number;
};

export enum MINE_ERRORS {
  NO_PICKAXES = "No pickaxes left",
  NO_IRON = "No iron",
  STILL_RECOVERING = "Iron is still recovering",
  EXPANSION_HAS_NO_IRON = "Expansion has no iron",
  NO_EXPANSION = "Expansion does not exist",
  NO_BUMPKIN = "You do not have a Bumpkin",
}

type GetMinedAtArgs = {
  createdAt: number;
  collectibles: Collectibles;
};

/**
 * Set a mined in the past to make it replenish faster
 */
export function getMinedAt({
  createdAt,
  collectibles,
}: GetMinedAtArgs): number {
  let time = createdAt;

  if (isCollectibleActive("Time Warp Totem", collectibles)) {
    time -= IRON_RECOVERY_TIME * 0.5 * 1000;
  }

  return time;
}

export function mineIron({
  state,
  action,
  createdAt = Date.now(),
}: Options): GameState {
  const stateCopy = cloneDeep(state);
  const { iron, bumpkin, collectibles } = stateCopy;

  if (!bumpkin) {
    throw new Error(MINE_ERRORS.NO_BUMPKIN);
  }

  const ironRock = iron[action.index];

  if (!ironRock) {
    throw new Error(MINE_ERRORS.NO_IRON);
  }

  if (!canMine(ironRock, IRON_RECOVERY_TIME, createdAt)) {
    throw new Error(MINE_ERRORS.STILL_RECOVERING);
  }

  const toolAmount = stateCopy.inventory["Stone Pickaxe"] || new Decimal(0);

  if (toolAmount.lessThan(1)) {
    throw new Error(MINE_ERRORS.NO_PICKAXES);
  }

  const ironMined = ironRock.stone.amount;
  const amountInInventory = stateCopy.inventory.Iron || new Decimal(0);

  ironRock.stone = {
    minedAt: getMinedAt({ createdAt, collectibles }),
    amount: 2,
  };
  bumpkin.activity = trackActivity("Iron Mined", bumpkin.activity);

  stateCopy.inventory["Stone Pickaxe"] = toolAmount.sub(1);
  stateCopy.inventory.Iron = amountInInventory.add(ironMined);

  return stateCopy;
}
