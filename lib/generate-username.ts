const initialPattern = /^[A-Z]$/;

/**
 * Returns the A-Z initial used in a Username, or null when the name cannot
 * produce one. Exported so form validation can use exactly the same rule.
 */
export function usernameInitial(name: string): string | null {
  const normalized = name.normalize("NFD").replace(/\p{M}/gu, "");
  const initial = Array.from(normalized)[0]?.toUpperCase();

  return initial && initialPattern.test(initial) ? initial : null;
}

export function generateUsername(
  year: number,
  firstName: string,
  lastName: string,
  nextSequenceNumber: number,
): string {
  const firstInitial = usernameInitial(firstName);
  const lastInitial = usernameInitial(lastName);

  if (!firstInitial || !lastInitial) {
    throw new Error("First and last names must start with an A-Z letter.");
  }

  const initials = `${firstInitial}${lastInitial}`;

  return `${year}-${initials}-${String(nextSequenceNumber).padStart(3, "0")}`;
}
