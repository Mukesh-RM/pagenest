export interface BergamotRegistryFile {
  readonly name: string;
  readonly size: number;
  readonly expectedSha256Hash?: string;
}

export type BergamotRegistryPair = Readonly<Record<string, BergamotRegistryFile | undefined>>;

export type BergamotRegistry = Readonly<Record<string, BergamotRegistryPair>>;
