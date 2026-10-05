import { randomInt } from "node:crypto";

// No 0/O, 1/l/I: the password is read from an email and typed by hand.
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%*?";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

export const TEMPORARY_PASSWORD_LENGTH = 16;

function pick(characters: string): string {
  return characters[randomInt(characters.length)];
}

/** A random Temporary password with at least one character of each class, shuffled. */
export function generateTemporaryPassword(): string {
  const characters = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];

  while (characters.length < TEMPORARY_PASSWORD_LENGTH) {
    characters.push(pick(ALL));
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    [characters[index], characters[swap]] = [characters[swap], characters[index]];
  }

  return characters.join("");
}
