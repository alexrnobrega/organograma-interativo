ORGANOGRAMA INTERATIVO AUTÔNOMO DA ESTRUTURA BÁSICA DA SECRETARIA DE ESTADO DE POLÍCIA CIVIL DO ESTADO DO RIO DE JANEIRO

Versão autônoma e completa do organograma interativo, desenvolvida como página HTML independente.

Esta versão pode ser executada isoladamente para fins de demonstração, validação, testes e referência técnica, sem depender da estrutura do site institucional.


ESTRUTURA DO PROJETO
--------------------

organograma-interativo-autonomo/
├── index.html
├── README.txt
├── css/
│   └── organograma.css
├── js/
│   └── organograma.js
└── data/
    └── estrutura-organizacional.json


ARQUIVOS
--------

- index.html
  Página HTML completa do organograma interativo.

- css/organograma.css
  Contém os estilos visuais, regras de responsividade e estilos de impressão.

- js/organograma.js
  Contém a lógica de interatividade, modais, SVG, zoom, alternância de visualizações e carregamento dos dados.

- data/estrutura-organizacional.json
  Contém a estrutura organizacional utilizada pelo organograma, incluindo a hierarquia e as informações adicionais exibidas pela interface.


CARREGAMENTO DOS DADOS
----------------------

Os dados organizacionais são mantidos em arquivo JSON independente e carregados pelo JavaScript por meio de fetch().

Em razão das restrições de segurança dos navegadores, o carregamento por fetch() normalmente não funciona quando o arquivo index.html é aberto diretamente por:

file://

Para funcionamento correto, o projeto deve ser servido por HTTP ou HTTPS.


EXECUÇÃO LOCAL
---------------

Opção 1 — VS Code

Utilizar uma extensão de servidor local, como Live Server, e abrir o projeto por meio do endereço HTTP fornecido pela extensão.

Opção 2 — Python

No terminal, dentro da pasta do projeto, executar:

python -m http.server 8000

Depois, acessar no navegador:

http://localhost:8000/


FUNCIONALIDADES
---------------

A página autônoma disponibiliza os recursos do organograma interativo em uma interface completa, incluindo:

- visualização do organograma;
- visualização vertical;
- controles de zoom;
- ajuste automático de visualização;
- expansão e recolhimento de estruturas;
- exibição de informações complementares;
- modais;
- representação gráfica em SVG;
- impressão do organograma.


UTILIZAÇÃO
----------

Esta versão foi concebida para funcionar como página independente.

O arquivo index.html contém a estrutura completa necessária para sua execução, incluindo os elementos próprios da página do organograma.

Para utilizar o projeto:

1. manter a estrutura de diretórios indicada neste README;
2. servir a pasta por HTTP ou HTTPS;
3. acessar o arquivo index.html pelo navegador;
4. conferir se o arquivo data/estrutura-organizacional.json foi carregado corretamente.


CAMINHOS DOS ARQUIVOS
---------------------

Os caminhos relativos utilizados pelo HTML, CSS e JavaScript pressupõem a manutenção da estrutura de diretórios do projeto.

Exemplo:

organograma-interativo-autonomo/
├── index.html
├── css/
│   └── organograma.css
├── js/
│   └── organograma.js
└── data/
    └── estrutura-organizacional.json

Caso os arquivos sejam movidos para outros diretórios, os respectivos caminhos deverão ser ajustados.


IMPRESSÃO
---------

A funcionalidade de impressão foi desenvolvida considerando esta versão como página autônoma.

As regras de impressão foram preparadas para exibir o conteúdo do organograma sem os controles utilizados apenas para navegação e interação na tela.

Antes da disponibilização definitiva, recomenda-se conferir a saída de impressão no navegador e nos formatos de papel utilizados pelo ambiente de destino.


OBSERVAÇÃO
----------

Esta versão corresponde à implementação autônoma do organograma interativo.

Ela pode ser utilizada para demonstração, testes, validação funcional e referência técnica, independentemente do site institucional.