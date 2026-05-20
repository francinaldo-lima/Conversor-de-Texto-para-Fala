export interface SampleText {
  id: string;
  title: string;
  category: string;
  text: string;
}

export const PORTUGUESE_SAMPLES: SampleText[] = [
  {
    id: "poesia",
    title: "Poema de Fernando Pessoa",
    category: "Poesia",
    text: "O poeta é um fingidor.\nFinge tão completamente\nQue chega a fingir que é dor\nA dor que deveras sente.\n\nE os que lêem o que escreve,\nNa dor lida sentem bem,\nNão as duas que ele teve,\nMas só a que eles não têm."
  },
  {
    id: "fábula",
    title: "O Robô Curioso",
    category: "Conto",
    text: "Era uma vez um pequeno robô chamado faísca, que vivia em uma grande fábrica de relógios. Ao contrário de seus colegas, que sabiam apenas contar as horas, faísca adorava ouvir as histórias que o vento contava quando soprava pelas janelas. Ele sonhava um dia poder falar com os pássaros e aprender a cantar como eles."
  },
  {
    id: "tecnologia",
    title: "Avanço da Inteligência Artificial",
    category: "Tecnologia",
    text: "A inteligência artificial está transformando profundamente a forma como interagimos com a tecnologia. Novas vozes neurais, geradas em tempo real por modelos generativos altamente sofisticados, aproximam a comunicação digital de uma conversa humana, com entonação expressiva, pausas naturais para respiração e calor emocional."
  },
  {
    id: "meditacao",
    title: "Minuto de Mindfulness",
    category: "Bem-estar",
    text: "Feche os olhos por um instante. Respire fundo, enchendo os pulmões de ar puro, e solte devagar... Sinta o peso do seu corpo se acomodar de forma suave. Deixe que os pensamentos passem como nuvens ao vento, e apenas sinta a tranquilidade do momento presente."
  }
];
