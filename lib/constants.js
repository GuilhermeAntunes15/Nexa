export const NEXA_GOALS = [
  { value: "friendship", label: "Fazer novas amizades" },
  { value: "study", label: "Encontrar companhia para estudar" },
  { value: "career", label: "Trocar experiências de carreira" },
  { value: "projects", label: "Criar projetos juntas" },
  { value: "events", label: "Encontrar companhia para eventos" },
  { value: "sports", label: "Praticar esportes" },
  { value: "support", label: "Dar ou receber apoio" }
];

export const NEXA_INTENTIONS = [
  { value: "friendship", label: "Fazer amizade" },
  { value: "study", label: "Estudar" },
  { value: "talk", label: "Conversar" },
  { value: "coffee", label: "Tomar café" },
  { value: "event", label: "Ir a um evento" },
  { value: "sport", label: "Praticar esporte" },
  { value: "help", label: "Posso ajudar" }
];

export const MAP_INTENTION_COLORS = {
  friendship: "#55A77B",
  study: "#5F78D7",
  talk: "#9A64CA",
  coffee: "#D79A55",
  event: "#DF7654",
  sport: "#4C9E9B",
  help: "#DAB448"
};

export const MAP_INTENTION_LABELS = Object.fromEntries(
  NEXA_INTENTIONS.map((item) => [item.value, item.label])
);
