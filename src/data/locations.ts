export type DummyLocation = {
  id: string;
  name: string;
  shortName: string;
  floors: string[];
  address: string;
  mapsLink: string;
};

export const DUMMY_LOCATIONS: DummyLocation[] = [
  {
    id: "dummy-1",
    name: "Dana Reksa",
    shortName: "Dana Reksa",
    floors: ["Lantai 5", "Lantai 15"],
    address: "Jl. Medan Merdeka Barat, Jakarta",
    mapsLink: "https://www.google.com/maps?q=Jl.+Medan+Merdeka+Barat,+Jakarta",
  },
];
