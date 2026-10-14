/**
 * Organograma interativo da Secretaria de Estado de Polícia Civil (SEPOL / PCERJ).
 *
 * Responsabilidades deste arquivo:
 * - carregar a estrutura organizacional a partir do JSON externo;
 * - montar o organograma principal (desktop/original);
 * - montar a visualização vertical simplificada (mobile);
 * - abrir e fechar os modais hierárquicos;
 * - desenhar e recalcular os conectores em SVG;
 * - controlar zoom, responsividade e alternância entre visualizações;
 * - manter recursos básicos de acessibilidade do modal.
 *
 * Dependências esperadas no HTML:
 * - #sepol-org
 * - .chart
 * - .wires
 * - .stage
 * - .viewport
 * - .modal
 * - .modal-body
 * - #sepol-modal-title
 * - .modal-close
 * - .vertical-view
 * - .zoom-in
 * - .zoom-out
 * - .zoom-reset
 * - .zoom-value
 * - .show-original
 * - .show-vertical
 *
 * Fonte de dados:
 * - data/estrutura-organizacional.json
 */

(async () => {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. ELEMENTO-RAIZ DO COMPONENTE
  // ---------------------------------------------------------------------------

  /**
   * Container principal do organograma.
   * Se ele não existir, o script é encerrado sem gerar erro.
   */
  const mount = document.getElementById('sepol-org');

  if (!mount) {
    return;
  }

  // ---------------------------------------------------------------------------
  // 2. CARREGAMENTO DO JSON EXTERNO
  // ---------------------------------------------------------------------------

  /**
   * Objeto bruto carregado do arquivo JSON.
   * Espera-se que ele contenha pelo menos a propriedade "organization".
   */
  let payload;

  try {
    /**
     * O parâmetro cache: 'no-store' evita que o navegador reutilize uma versão
     * antiga do JSON durante o desenvolvimento.
     */
    const response = await fetch('data/estrutura-organizacional.json', {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Falha ao carregar os dados: HTTP ${response.status}`);
    }

    payload = await response.json();
  } catch (error) {
    console.error(
      '[Organograma SEPOL] Não foi possível carregar o JSON.',
      error,
    );

    /**
     * Exibe uma mensagem amigável quando o JSON não pode ser carregado.
     * Isso normalmente acontece ao abrir o index.html diretamente por file://,
     * em vez de utilizar um servidor HTTP/HTTPS, como o Live Server.
     */
    const warning = document.createElement('p');

    warning.style.cssText = [
      'margin:16px',
      'padding:12px',
      'border:1px solid #b42318',
      'background:#fff5f5',
      'color:#7a271a',
      'font:14px Segoe UI,Arial,sans-serif',
    ].join(';');

    warning.textContent =
      'Não foi possível carregar data/estrutura-organizacional.json. ' +
      'Abra o projeto por um servidor HTTP/HTTPS, e não diretamente por file://.';

    mount.appendChild(warning);
    return;
  }

  // ---------------------------------------------------------------------------
  // 3. DADOS PRINCIPAIS E ÍNDICE DE ACESSO RÁPIDO
  // ---------------------------------------------------------------------------

  /**
   * Estrutura organizacional completa.
   */
  const DATA = payload.organization;

  /**
   * Conteúdos complementares que não devem ser forçados artificialmente
   * dentro da hierarquia principal, como comissões e fundos.
   */
  const EXTRAS = payload.extras || {
    commissions: [],
    funds: [],
  };

  /**
   * Mapa id -> unidade organizacional.
   * Permite localizar rapidamente qualquer nó sem percorrer toda a árvore.
   */
  const index = new Map();

  /**
   * Percorre recursivamente a estrutura do JSON e preenche o índice.
   *
   * @param {Object} node Unidade organizacional atual.
   */
  (function walk(node) {
    index.set(node.id, node);
    node.children.forEach(walk);
  })(DATA);

  // ---------------------------------------------------------------------------
  // 4. REFERÊNCIAS A ELEMENTOS DO DOM
  // ---------------------------------------------------------------------------

  /** Área principal onde o organograma original é desenhado. */
  const chart = mount.querySelector('.chart');

  /** SVG usado exclusivamente para os conectores do organograma. */
  const svg = mount.querySelector('.wires');

  /** Container dimensionado de acordo com o zoom aplicado. */
  const stage = mount.querySelector('.stage');

  /** Área rolável do organograma original. */
  const viewport = mount.querySelector('.viewport');

  /** Fundo/modal principal. */
  const modal = mount.querySelector('.modal');

  /** Corpo do modal, que recebe a árvore hierárquica completa. */
  const modalBody = mount.querySelector('.modal-body');

  /** Título do modal. */
  const modalTitle = mount.querySelector('#sepol-modal-title');

  /** Botão Imprimir localizado no rodapé do modal. */
  const modalPrintButton = mount.querySelector('.modal-print');

  /** Botão Fechar localizado no rodapé do modal. */
  const modalFooterCloseButton = mount.querySelector(
    '.modal-footer-close',
  );

  // ---------------------------------------------------------------------------
  // 5. ESTADO INTERNO
  // ---------------------------------------------------------------------------

  /**
   * Guarda o elemento que possuía foco antes da abertura do modal.
   * Isso permite devolver o foco corretamente ao fechar a janela.
   */
  let lastFocus = null;

  /**
   * Escala atual do organograma original.
   * 1 = 100%.
   */
  let scale = 1;

  // ---------------------------------------------------------------------------
  // 6. FUNÇÕES AUXILIARES DE CRIAÇÃO DE ELEMENTOS
  // ---------------------------------------------------------------------------

  /**
   * Cria um elemento HTML, aplica classe, texto e pai opcionalmente.
   *
   * @param {string} tag Nome da tag HTML.
   * @param {string} className Classes CSS.
   * @param {HTMLElement|null} parent Elemento pai.
   * @param {string|undefined} text Texto do elemento.
   * @returns {HTMLElement}
   */
  function el(tag, className, parent, text) {
    const node = document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (text !== undefined) {
      node.textContent = text;
    }

    if (parent) {
      parent.appendChild(node);
    }

    return node;
  }

  /**
   * Cria visualmente um nó clicável do organograma.
   *
   * @param {string} id ID da unidade no JSON.
   * @param {HTMLElement} parent Elemento onde o botão será inserido.
   * @param {string} cls Classes adicionais, como "gray" ou "black".
   * @param {Object} css Estilos inline adicionais.
   * @returns {HTMLButtonElement|null}
   */
  function visual(id, parent, cls = '', css = null) {
    const organizationNode = index.get(id);

    if (!organizationNode) {
      return null;
    }

    const button = el(
      'button',
      `node ${cls}`,
      parent,
      organizationNode.name,
    );

    button.type = 'button';
    button.dataset.id = id;

    if (css) {
      Object.assign(button.style, css);
    }

    return button;
  }

  /**
   * Cria um nó absolutamente posicionado no organograma original.
   *
   * @param {string} id ID da unidade.
   * @param {HTMLElement} parent Elemento pai.
   * @param {string} klass Classe adicional do wrapper.
   * @param {number} x Posição horizontal, em pixels.
   * @param {number} y Posição vertical, em pixels.
   * @param {number} width Largura do wrapper, em pixels.
   * @param {boolean} gray Define se o nó deverá utilizar estilo cinza.
   * @returns {HTMLElement}
   */
  function positioned(id, parent, klass, x, y, width, gray = false) {
    const holder = el('div', `chart-node ${klass || ''}`, parent);

    Object.assign(holder.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
    });

    visual(
      id,
      holder,
      id === 'sepol' ? 'black' : gray ? 'gray' : '',
    );

    return holder;
  }

  // ---------------------------------------------------------------------------
  // 7. MONTAGEM DOS NÓS SUPERIORES DO ORGANOGRAMA ORIGINAL
  // ---------------------------------------------------------------------------

  /** Nó raiz: Secretaria de Estado de Polícia Civil. */
  positioned('sepol', chart, 'root', 580, 22, 320);

  /** Conselho Superior de Polícia, à esquerda do eixo vertical central. */
  positioned('6', chart, 'upper-node', 510, 115, 185);

  /**
   * Nós diretamente ligados ao Gabinete/Secretaria no lado direito.
   * Os valores de x/y reproduzem o desenho institucional de referência.
   */
  positioned('1.1', chart, 'upper-node', 785, 115, 220);
  positioned('1.2', chart, 'upper-node', 785, 185, 220);
  positioned('1.3', chart, 'upper-node', 785, 255, 220);
  positioned('1.4', chart, 'upper-node', 785, 325, 220);
  positioned('1.5', chart, 'upper-node', 785, 395, 220);
  positioned('1.6', chart, 'upper-node', 785, 465, 220);

  /**
   * Cria os grupos laterais do lado esquerdo que possuem filhos visíveis
   * no organograma principal, como Corregedoria e Controladoria.
   *
   * @param {string} id ID do nó pai.
   * @param {string[]} children IDs dos filhos exibidos graficamente.
   * @param {number} y Posição vertical do grupo.
   * @param {boolean} two Ativa layout especial para dois filhos.
   * @returns {HTMLElement}
   */
  function group(id, children, y, two = false) {
    const groupElement = el(
      'div',
      `left-group${two ? ' two-group' : ''}`,
      chart,
    );
    groupElement.style.top = `${y}px`;

    const parentContainer = el('div', 'parent', groupElement);
    visual(id, parentContainer, '');

    const childrenContainer = el(
      'div',
      `children${two ? ' two' : ''}`,
      groupElement,
    );

    for (const childId of children) {
      const childContainer = el('div', 'child', childrenContainer);
      visual(childId, childContainer, 'gray');
    }

    return groupElement;
  }

  /**
   * Mantém no desenho principal somente as unidades que aparecem no PDF.
   * A estrutura completa continua disponível no modal via JSON.
   */
  group(
    '1.7',
    ['1.7.5', '1.7.6', '1.7.7', '1.7.8'],
    185,
  );

  group(
    '1.8',
    ['1.8.4', '1.8.5'],
    390,
    true,
  );

  // ---------------------------------------------------------------------------
  // 8. MONTAGEM DAS QUATRO SUBSECRETARIAS PRINCIPAIS
  // ---------------------------------------------------------------------------

  /**
   * Linha visual inferior do organograma.
   * Cada coluna representa uma das quatro subsecretarias principais.
   */
  const row = el('div', 'subrow', chart);

  /**
   * Unidades que aparecem explicitamente no organograma principal.
   *
   * IMPORTANTE:
   * A ordem abaixo acompanha a numeração da estrutura organizacional oficial.
   *
   * Nem todos os descendentes reais são exibidos no desenho principal.
   * Estruturas muito extensas são representadas por nós-resumo, enquanto
   * o modal continua utilizando a hierarquia completa existente no JSON.
   */
  const displayed = {
    '2': [
      '2.2',
      '2.3',
      '2.4',
      '2.5',
      '2.6',
      '2.7',
    ],

    /**
     * Subsecretaria de Planejamento e Integração Operacional.
     *
     * Ordem documental:
     * 3.1 → 3.14
     */
    '3': [
      '3.1',
      '3.2',
      '3.3',
      '3.4',
      '3.5',
      '3.6',
      '3.7',
      '3.8',
      '3.9',
      '3.10',
      '3.11',
      '3.12',
      '3.13',
      '3.14',
    ],

    '4': [
      '4.2',
      '4.3',
      '4.4',
      '4.5',
      '4.6',
      '4.7',
    ],

    '5': [
      '5.3',
      '5.4',
    ],
  };

  /**
   * Descendentes reais que também devem aparecer resumidamente
   * no organograma principal.
   *
   * ATENÇÃO:
   * Esta estrutura NÃO substitui o JSON.
   *
   * Ela controla somente quais níveis da hierarquia completa serão
   * visualizados no desenho principal.
   */
  const nested = {
    /**
     * Departamento-Geral de Polícia da Capital.
     *
     * Exibe:
     * - 1º DPA
     * - 2º DPA
     *
     * As delegacias reais ficam somente no modal.
     */
    '3.7': [
      '3.7.1',
      '3.7.2',
    ],

    /**
     * Departamento-Geral de Polícia da Baixada.
     */
    '3.8': [
      '3.8.1',
    ],

    /**
     * Departamento-Geral de Polícia do Interior.
     */
    '3.9': [
      '3.9.1',
      '3.9.2',
      '3.9.3',
      '3.9.4',
    ],

    /**
     * Departamento-Geral de Combate à Corrupção,
     * ao Crime Organizado e à Lavagem de Dinheiro.
     *
     * O Laboratório e o Gabinete aparecem individualmente no desenho.
     * As duas delegacias serão representadas por um nó-resumo.
     */
    '3.12': [
      '3.12.3',
      '3.12.4',
    ],

    /**
     * Departamento-Geral de Polícia de Atendimento à Mulher.
     *
     * O Centro de Estudos aparece nominalmente.
     * As DEAMs serão representadas por um nó-resumo.
     */
    '3.13': [
      '3.13.1',
    ],

    /**
     * Estrutura técnico-científica já existente.
     */
    '5.4': [
      '5.4.1',
      '5.4.2',
      '5.4.3',
      '5.4.4',
      '5.4.5',
      '5.4.6',
      '5.4.7',
      '5.4.8',
      '5.4.9',
    ],
  };

  /**
   * Adiciona ao organograma principal uma unidade que deve ser exibida
   * conforme o desenho institucional.
   *
   * Esta função trabalha em duas camadas:
   *
   * 1. nós reais:
   *    provenientes diretamente de estrutura-organizacional.json;
   *
   * 2. nós-resumo:
   *    utilizados somente para representar conjuntos muito extensos,
   *    como delegacias distritais e especializadas.
   *
   * @param {string} id
   * ID da unidade real.
   *
   * @param {HTMLElement} parent
   * Elemento HTML que receberá a unidade.
   *
   * @param {number} depth
   * Profundidade visual do nó.
   *
   * @returns {HTMLElement|undefined}
   */
  function addDisplayed(id, parent, depth = 0) {
    /**
     * Segurança:
     * impede tentativa de renderizar um ID inexistente no JSON.
     */
    if (!index.has(id)) {
      return;
    }

    /**
     * Primeiro nível usa .direct.
     * Níveis internos usam .branch.
     */
    const wrapper = el(
      'div',
      depth ? 'branch' : 'direct',
      parent,
    );

    /**
     * Renderiza o órgão real.
     */
    visual(id, wrapper, 'gray');

    /**
     * Recupera descendentes que devem aparecer nominalmente
     * no organograma principal.
     */
    const children = nested[id];

    if (children && children.length) {
      const inner = el(
        'div',
        'descendants',
        wrapper,
      );

      for (const childId of children) {
        addDisplayed(
          childId,
          inner,
          depth + 1,
        );
      }
    }

    /**
     * ================================================================
     * DELEGACIAS DISTRITAIS
     * ================================================================
     *
     * Cada Departamento de Polícia de Área possui diversas delegacias.
     *
     * Essas delegacias NÃO são individualizadas no organograma
     * principal. Elas continuam disponíveis integralmente no modal.
     */
    if (districtPoliceDepartments.has(id)) {
      let inner = wrapper.querySelector(
        ':scope > .descendants',
      );

      if (!inner) {
        inner = el(
          'div',
          'descendants',
          wrapper,
        );
      }

      summaryVisual(
        id,
        'Delegacias Distritais',
        inner,
      );
    }

    /**
     * ================================================================
     * DEPARTAMENTO-GERAL DE POLÍCIA ESPECIALIZADA
     * ================================================================
     */
    if (id === '3.10') {
      const inner = el(
        'div',
        'descendants',
        wrapper,
      );

      summaryVisual(
        '3.10',
        'Delegacias Especializadas',
        inner,
      );
    }

    /**
     * ================================================================
     * DEPARTAMENTO-GERAL DE HOMICÍDIOS E PROTEÇÃO À PESSOA
     * ================================================================
     */
    if (id === '3.11') {
      const inner = el(
        'div',
        'descendants',
        wrapper,
      );

      summaryVisual(
        '3.11',
        'Delegacias Especializadas',
        inner,
      );
    }

    /**
     * ================================================================
     * DEPARTAMENTO-GERAL DE COMBATE À CORRUPÇÃO,
     * AO CRIME ORGANIZADO E À LAVAGEM DE DINHEIRO
     * ================================================================
     *
     * As delegacias 3.12.1 e 3.12.2 são representadas
     * por "Delegacias Especializadas".
     *
     * O Laboratório (3.12.3) e o Gabinete (3.12.4)
     * continuam aparecendo nominalmente.
     */
    if (id === '3.12') {
      const inner =
        wrapper.querySelector(
          ':scope > .descendants',
        ) ||
        el(
          'div',
          'descendants',
          wrapper,
        );

      /**
       * Insere o resumo antes do Laboratório e do Gabinete.
       */
      const summary = summaryVisual(
        '3.12',
        'Delegacias Especializadas',
        inner,
      );

      inner.prepend(summary);
    }

    /**
     * ================================================================
     * DEPARTAMENTO-GERAL DE POLÍCIA DE ATENDIMENTO À MULHER
     * ================================================================
     *
     * 3.13.1 continua nominalmente no organograma.
     *
     * 3.13.2 a 3.13.17 são resumidos visualmente como
     * "Delegacias de Atendimento à Mulher".
     */
    if (id === '3.13') {
      const inner =
        wrapper.querySelector(
          ':scope > .descendants',
        ) ||
        el(
          'div',
          'descendants',
          wrapper,
        );

      summaryVisual(
        '3.13',
        'Delegacias de Atendimento à Mulher',
        inner,
      );
    }

    /**
     * ================================================================
     * DEPARTAMENTO-GERAL DE POLÍCIA DAS DELEGACIAS
     * DE ACERVO CARTORÁRIO
     * ================================================================
     *
     * As unidades 3.14.1 a 3.14.8 ficam disponíveis no modal.
     */
    if (id === '3.14') {
      const inner = el(
        'div',
        'descendants',
        wrapper,
      );

      summaryVisual(
        '3.14',
        'Delegacias de Acervo Cartorário',
        inner,
      );
    }

    return wrapper;
  }

    /**
     * Cria um nó-resumo exclusivamente visual.
     *
     * Um nó-resumo representa, no organograma principal, um conjunto
     * potencialmente grande de unidades reais existentes no JSON.
     *
     * Exemplos:
     * - "Delegacias Distritais";
     * - "Delegacias Especializadas";
     * - "Delegacias de Atendimento à Mulher".
     *
     * O data-id recebe o ID do órgão real responsável pelo grupo.
     * Dessa forma, ao clicar no nó-resumo, o modal abre a unidade real
     * correspondente e apresenta toda a hierarquia cadastrada no JSON.
     *
     * @param {string} targetId
     * ID da unidade real que deverá ser aberta no modal.
     *
     * @param {string} label
     * Texto exibido no organograma.
     *
     * @param {HTMLElement} parent
     * Container onde o nó será inserido.
     *
     * @returns {HTMLButtonElement}
     */
    function summaryVisual(targetId, label, parent) {
      const button = el(
        'button',
        'node gray summary-node',
        parent,
        label,
      );

      button.type = 'button';

      /**
       * Reutilizamos data-id porque o listener global do organograma
       * já sabe abrir o modal a partir desse atributo.
       */
      button.dataset.id = targetId;

      return button;
    }

  /**
   * Define quais Departamentos de Polícia de Área deverão receber,
   * no organograma principal, um nó visual "Delegacias Distritais".
   *
   * Cada ID corresponde a um DPA real do JSON.
   */
  const districtPoliceDepartments = new Set([
    '3.7.1', // 1º Departamento de Polícia de Área
    '3.7.2', // 2º Departamento de Polícia de Área
    '3.8.1', // 3º Departamento de Polícia de Área
    '3.9.1', // 4º Departamento de Polícia de Área
    '3.9.2', // 5º Departamento de Polícia de Área
    '3.9.3', // 6º Departamento de Polícia de Área
    '3.9.4', // 7º Departamento de Polícia de Área
  ]);

  /**
   * Cria cada uma das quatro colunas principais.
   */
  for (const id of ['2', '3', '4', '5']) {
    const column = el('section', 'subcolumn', row);

    visual(id, column, '');

    displayed[id].forEach((childId) => {
      addDisplayed(childId, column);
    });
  }

  // ---------------------------------------------------------------------------
  // 9. RENDERIZAÇÃO DA ÁRVORE COMPLETA NOS MODAIS
  // ---------------------------------------------------------------------------

  /**
   * Monta o texto de apresentação de uma unidade, acrescentando a sigla
   * institucional quando ela existir no JSON.
   *
   * Exemplos:
   *
   * Departamento-Geral de Polícia Técnico-Científica – DGPTC
   *
   * 1º Departamento de Polícia de Área – 1º DPA
   *
   * @param {Object} node Unidade organizacional.
   * @returns {string}
   */
  function getInstitutionalLabel(node) {
    const sigla = node.info?.sigla?.trim();

    if (!sigla) {
      return node.name;
    }

    /**
     * Evita repetir a sigla caso ela já esteja presente
     * no final da própria denominação da unidade.
     *
     * Exemplo:
     *
     * "DGPTC - Departamento..."
     *
     * ou
     *
     * "Departamento... - DGPTC"
     */
    const escapedSigla = sigla.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    );

    const siglaAlreadyPresent = new RegExp(
      `(?:\\s*[–-]\\s*)?${escapedSigla}$`,
      'i',
    ).test(node.name.trim());

    return siglaAlreadyPresent
      ? node.name
      : `${node.name} – ${sigla}`;
  }


  /**
   * Verifica se a unidade possui informações institucionais
   * efetivamente exibíveis no modal.
   *
   * A existência somente de uma sigla NÃO torna a unidade
   * expansível, porque a sigla já aparece no próprio título.
   *
   * @param {Object} node Unidade organizacional.
   * @returns {boolean}
   */
  function hasInstitutionalInfo(node) {
    const info = node.info;

    if (!info) {
      return false;
    }

    return Boolean(
      info.endereco ||
      info.responsavel ||
      (
        Array.isArray(info.telefones) &&
        info.telefones.length
      ) ||
      (
        Array.isArray(info.celulares) &&
        info.celulares.length
      ) ||
      (
        Array.isArray(info.observacoes) &&
        info.observacoes.length
      )
    );
  }


  /**
   * Renderiza as informações institucionais de uma unidade.
   *
   * Ordem de apresentação:
   *
   * 1. Endereço
   * 2. Responsável
   * 3. Telefones
   * 4. Celulares
   * 5. Observações
   *
   * Quando inline = false:
   * a ficha pertence à unidade principal aberta no modal.
   *
   * Quando inline = true:
   * a ficha pertence a um item da árvore e será exibida
   * imediatamente abaixo dele quando o <details> for expandido.
   *
   * @param {Object} node Unidade organizacional.
   * @param {HTMLElement} parent Elemento que receberá a ficha.
   * @param {boolean} inline Indica ficha interna da árvore.
   * @returns {HTMLElement|null}
   */
  function renderInstitutionalInfo(
    node,
    parent,
    inline = false,
  ) {
    /**
     * Não cria uma seção vazia quando a unidade
     * não possui informações institucionais.
     */
    if (!hasInstitutionalInfo(node)) {
      return null;
    }

    const info = node.info;

    /**
     * A ficha principal e as fichas internas recebem
     * classes diferentes para permitir estilização própria.
     */
    const section = el(
      'section',
      inline
        ? 'institutional-info institutional-info-inline'
        : 'institutional-info',
      parent,
    );


    /**
     * ================================================================
     * ENDEREÇO
     * ================================================================
     */
    if (info.endereco) {
      const row = el(
        'div',
        'info-row',
        section,
      );

      el(
        'strong',
        'info-label',
        row,
        'Endereço:',
      );

      el(
        'span',
        'info-value',
        row,
        info.endereco,
      );
    }


    /**
     * ================================================================
     * RESPONSÁVEL
     * ================================================================
     */
    if (info.responsavel) {
      const row = el(
        'div',
        'info-row',
        section,
      );

      el(
        'strong',
        'info-label',
        row,
        'Responsável:',
      );

      el(
        'span',
        'info-value',
        row,
        info.responsavel,
      );
    }


    /**
     * ================================================================
     * TELEFONES
     * ================================================================
     */
    if (
      Array.isArray(info.telefones) &&
      info.telefones.length
    ) {
      const row = el(
        'div',
        'info-row',
        section,
      );

      el(
        'strong',
        'info-label',
        row,
        'Telefones:',
      );

      el(
        'span',
        'info-value',
        row,
        info.telefones.join(' / '),
      );
    }


    /**
     * ================================================================
     * CELULARES
     * ================================================================
     */
    if (
      Array.isArray(info.celulares) &&
      info.celulares.length
    ) {
      const row = el(
        'div',
        'info-row',
        section,
      );

      el(
        'strong',
        'info-label',
        row,
        'Celulares:',
      );

      el(
        'span',
        'info-value',
        row,
        info.celulares.join(' / '),
      );
    }


    /**
     * ================================================================
     * OBSERVAÇÕES
     * ================================================================
     */
    if (
      Array.isArray(info.observacoes) &&
      info.observacoes.length
    ) {
      const row = el(
        'div',
        'info-row',
        section,
      );

      el(
        'strong',
        'info-label',
        row,
        'Observações:',
      );

      el(
        'span',
        'info-value',
        row,
        info.observacoes.join(' '),
      );
    }


    return section;
  }


  /**
   * Renderiza recursivamente todos os descendentes de uma unidade
   * dentro do MESMO modal.
   *
   * Esta função implementa o comportamento semelhante ao organograma
   * do TCE-RJ:
   *
   * - o modal principal nunca é substituído;
   *
   * - cada unidade aparece como um item hierárquico;
   *
   * - ao clicar em uma unidade, o próprio item é expandido;
   *
   * - os dados aparecem imediatamente abaixo dessa unidade;
   *
   * - depois dos dados aparecem seus eventuais subordinados;
   *
   * - vários itens podem permanecer abertos simultaneamente;
   *
   * - unidades sem filhos também podem ser expandidas quando
   *   possuírem informações institucionais.
   *
   * Regras:
   *
   * 1. possui filhos:
   *    vira <details>;
   *
   * 2. não possui filhos, mas possui informações:
   *    também vira <details>;
   *
   * 3. não possui filhos nem informações:
   *    permanece como .leaf não interativa.
   *
   * @param {Object} node Unidade organizacional atual.
   * @param {HTMLElement} parent Elemento que receberá os filhos.
   */
  function subtree(node, parent) {
    for (const child of node.children) {
      /**
       * Informa se esta unidade possui níveis hierárquicos
       * subordinados.
       */
      const hasChildren =
        Array.isArray(child.children) &&
        child.children.length > 0;

      /**
       * Informa se esta unidade possui ficha institucional.
       */
      const hasInfo =
        hasInstitutionalInfo(child);


      /**
       * ==============================================================
       * UNIDADE EXPANSÍVEL
       * ==============================================================
       *
       * Uma unidade será expansível se:
       *
       * - possuir filhos; OU
       * - possuir dados institucionais.
       */
      if (hasChildren || hasInfo) {
        const details = el(
          'details',
          'modal-tree-item',
          parent,
        );


        /**
         * ------------------------------------------------------------
         * CABEÇALHO DO ITEM
         * ------------------------------------------------------------
         *
         * O <summary> é o elemento que o usuário clica
         * para abrir ou fechar aquela unidade.
         */
        const summary = el(
          'summary',
          '',
          details,
        );


        /**
         * Código hierárquico.
         *
         * Exemplo:
         *
         * 3.7.1.1
         */
        el(
          'span',
          'node-code',
          summary,
          child.code,
        );


        /**
         * Denominação + sigla.
         *
         * Exemplo:
         *
         * 01ª Delegacia de Polícia - Praça Mauá – 1ª DP
         */
        summary.append(
          document.createTextNode(
            getInstitutionalLabel(child),
          ),
        );


        /**
         * ------------------------------------------------------------
         * FICHA INSTITUCIONAL DA PRÓPRIA UNIDADE
         * ------------------------------------------------------------
         *
         * A ficha fica DENTRO do <details>.
         *
         * Portanto:
         *
         * - não é exibida quando o item está fechado;
         * - aparece imediatamente abaixo do summary quando aberto;
         * - não substitui o conteúdo do modal;
         * - não chama openModal().
         */
        if (hasInfo) {
          renderInstitutionalInfo(
            child,
            details,
            true,
          );
        }


        /**
         * ------------------------------------------------------------
         * UNIDADES SUBORDINADAS
         * ------------------------------------------------------------
         *
         * Se esta unidade possuir filhos, eles são apresentados
         * depois da ficha institucional.
         *
         * Exemplo:
         *
         * ▼ Departamento
         *
         *   Endereço...
         *   Responsável...
         *
         *   ▶ Divisão 1
         *   ▶ Divisão 2
         */
        if (hasChildren) {
          const childrenContainer = el(
            'div',
            'modal-tree-children',
            details,
          );

          /**
           * Continua recursivamente a árvore.
           */
          subtree(
            child,
            childrenContainer,
          );
        }


        /**
         * O item já foi completamente construído.
         */
        continue;
      }


      /**
       * ==============================================================
       * UNIDADE TERMINAL SEM INFORMAÇÕES
       * ==============================================================
       *
       * Não existe motivo para permitir clique quando:
       *
       * - não há filhos;
       * - não há endereço;
       * - não há responsável;
       * - não há telefones;
       * - não há celulares;
       * - não há observações.
       */
      const leaf = el(
        'div',
        'leaf',
        parent,
      );


      /**
       * Código hierárquico.
       */
      el(
        'span',
        'node-code',
        leaf,
        child.code,
      );


      /**
       * Denominação da unidade.
       *
       * A sigla ainda pode aparecer no texto, caso exista,
       * mas o elemento permanece não interativo.
       */
      leaf.append(
        document.createTextNode(
          getInstitutionalLabel(child),
        ),
      );
    }
  }


  /**
   * Abre o modal da unidade selecionada diretamente
   * no organograma principal ou na visualização vertical.
   *
   * IMPORTANTE:
   *
   * Esta função é chamada somente quando o usuário seleciona
   * uma unidade no ORGANOGRAMA.
   *
   * Os itens existentes DENTRO do modal não chamam openModal().
   * Eles utilizam apenas os próprios elementos <details>.
   *
   * @param {string} id ID da unidade.
   */
  function openModal(id) {
    const organizationNode = index.get(id);

    if (!organizationNode) {
      return;
    }


    /**
     * Guarda o elemento que estava com foco antes da abertura.
     *
     * O foco será devolvido a ele quando o modal for fechado.
     */
    lastFocus = document.activeElement;


    /**
     * ================================================================
     * TÍTULO DO MODAL
     * ================================================================
     *
     * Exemplos:
     *
     * Departamento-Geral de Polícia Técnico-Científica – DGPTC
     *
     * 1º Departamento de Polícia de Área – 1º DPA
     */
    modalTitle.textContent =
      getInstitutionalLabel(
        organizationNode,
      );


    /**
     * Limpa o conteúdo pertencente à abertura anterior.
     *
     * Essa limpeza acontece SOMENTE quando um novo modal é aberto
     * a partir do organograma.
     *
     * Expandir um item interno não executa esta função.
     */
    modalBody.replaceChildren();


    /**
     * ================================================================
     * FICHA DA UNIDADE PRINCIPAL
     * ================================================================
     *
     * As informações do órgão inicialmente selecionado aparecem
     * sempre no topo do modal.
     */
    renderInstitutionalInfo(
      organizationNode,
      modalBody,
    );


    /**
     * ================================================================
     * ÁRVORE DAS UNIDADES SUBORDINADAS
     * ================================================================
     */
    if (
      Array.isArray(
        organizationNode.children,
      ) &&
      organizationNode.children.length
    ) {
      /**
       * Instrução de uso da árvore.
       */
      el(
        'p',
        'note',
        modalBody,
        'Selecione as unidades para expandir ou recolher os respectivos níveis.',
      );


      /**
       * Constrói toda a hierarquia da unidade selecionada.
       *
       * Todos os níveis começam recolhidos.
       */
      subtree(
        organizationNode,
        modalBody,
      );
    } else {
      /**
       * A unidade principal não possui subordinados.
       *
       * Sua própria ficha continua sendo exibida normalmente.
       */
      el(
        'p',
        'note',
        modalBody,
        'Não há unidades subordinadas.',
      );
    }


    /**
     * ================================================================
     * SEÇÕES COMPLEMENTARES DA SEPOL
     * ================================================================
     */
    if (id === 'sepol') {
      el(
        'h3',
        'section',
        modalBody,
        'Outras seções',
      );

      el(
        'p',
        'note',
        modalBody,
        'Comissões e fundos são apresentados separadamente abaixo.',
      );


      const extraSections = [
        [
          'commissions',
          'Comissões',
        ],
        [
          'funds',
          'Fundos vinculados e transitório',
        ],
      ];


      for (
        const [key, label]
        of extraSections
      ) {
        el(
          'h4',
          '',
          modalBody,
          label,
        );


        EXTRAS[key].forEach(
          (item) => {
            el(
              'div',
              'leaf',
              modalBody,
              item,
            );
          },
        );
      }
    }


    /**
     * Exibe o modal.
     */
    modal.setAttribute(
      'aria-hidden',
      'false',
    );


    /**
     * Garante que toda nova abertura comece no topo.
     *
     * O reset é feito após o modal voltar a ficar visível,
     * no próximo frame de renderização.
     *
     * Isso evita que navegadores como o Safari/iOS
     * restaurem a posição de rolagem usada na abertura anterior.
     */
    requestAnimationFrame(() => {
      modalBody.scrollTop = 0;
    });


    /**
     * Impede que a página existente atrás do modal
     * seja rolada enquanto a janela estiver aberta.
     */
    document.body.style.overflow =
      'hidden';


    /**
     * Move inicialmente o foco para o botão Fechar.
     */
    mount
      .querySelector('.modal-close')
      .focus();
  }


  /**
   * Fecha o modal.
   */
  function closeModal() {
    modal.setAttribute(
      'aria-hidden',
      'true',
    );


    /**
     * Limpa a posição de rolagem usada nesta abertura.
     *
     * Assim, mesmo antes da próxima abertura,
     * o corpo do modal já permanece reposicionado no topo.
     */
    modalBody.scrollTop = 0;

    
    /**
     * Libera novamente o scroll da página.
     */
    document.body.style.overflow = '';


    /**
     * Devolve o foco para o elemento que abriu o modal.
     */
    lastFocus?.focus();
  }


  /**
   * Abre a caixa de diálogo de impressão do navegador.
   *
   * A seleção visual do que será efetivamente impresso
   * será controlada posteriormente pelo CSS em @media print.
   */
  function printModal() {
    /**
     * Segurança:
     * evita executar impressão caso o modal não esteja aberto.
     */
    if (
      modal.getAttribute('aria-hidden') !== 'false'
    ) {
      return;
    }

    window.print();
  }


  // ---------------------------------------------------------------------------
  // 10. EVENTOS DO MODAL
  // ---------------------------------------------------------------------------

  /**
   * Delegação de clique:
   * qualquer nó do organograma principal ou vertical pode abrir um modal.
   */
  mount.addEventListener('click', (event) => {
    const node = event.target.closest(
      '.node[data-id], .vnode[data-id]',
    );

    if (node && mount.contains(node)) {
      openModal(node.dataset.id);
    }
  });

  /**
   * Botão Fechar do cabeçalho.
   */
  mount
    .querySelector('.modal-close')
    .addEventListener(
      'click',
      closeModal,
    );


  /**
   * Botão Fechar existente no rodapé do modal.
   *
   * Reutiliza exatamente a mesma função utilizada
   * pelo botão × do cabeçalho.
   */
  modalFooterCloseButton.addEventListener(
    'click',
    closeModal,
  );


  /**
   * Botão Imprimir existente no rodapé do modal.
   */
  modalPrintButton.addEventListener(
    'click',
    printModal,
  );


  /**
   * Fecha o modal ao clicar no fundo escuro,
   * mas não quando o clique ocorrer dentro da caixa.
   */
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  /**
   * Acessibilidade por teclado do modal.
   */
  document.addEventListener('keydown', (event) => {
    /**
     * Ignora o evento caso o modal não esteja aberto.
     */
    if (modal.getAttribute('aria-hidden') !== 'false') {
      return;
    }

    /**
     * ESC fecha o modal.
     */
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
    }

    /**
     * Mantém TAB dentro do modal.
     */
    if (event.key === 'Tab') {
      const focusables = [
        ...modal.querySelectorAll(
          'button, summary, [tabindex="0"]',
        ),
      ].filter(
        (element) => element.getClientRects().length,
      );

      if (!focusables.length) {
        return;
      }

      const currentIndex = focusables.indexOf(
        document.activeElement,
      );

      /**
       * Shift + Tab no primeiro elemento leva ao último.
       */
      if (
        event.shiftKey &&
        currentIndex <= 0
      ) {
        event.preventDefault();
        focusables.at(-1).focus();
      }

      /**
       * Tab no último elemento leva ao primeiro.
       */
      if (
        !event.shiftKey &&
        currentIndex === focusables.length - 1
      ) {
        event.preventDefault();
        focusables[0].focus();
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 11. VISUALIZAÇÃO VERTICAL PARA SMARTPHONES
  // ---------------------------------------------------------------------------

  /**
   * Container da visualização vertical simplificada.
   */
  const verticalView = mount.querySelector('.vertical-view');

  /**
   * Monta recursivamente a estrutura vertical.
   *
   * @param {Object} node Unidade atual.
   * @param {HTMLElement} parent Elemento pai.
   * @param {number} depth Profundidade.
   */
  function verticalBranch(node, parent, depth = 0) {
    const holder = el(
      'div',
      'vitem',
      parent,
    );

    const header = el(
      'div',
      'vhead',
      holder,
    );

    const button = el(
      'button',
      `vnode ${
        !depth
          ? 'root-v'
          : depth > 1
            ? 'deep'
            : ''
      }`,
      header,
      node.name,
    );

    button.type = 'button';
    button.dataset.id = node.id;

    /**
     * Só cria botão de expansão se o nó realmente possuir filhos.
     */
    if (node.children.length) {
      const expander = el(
        'button',
        'expand',
        header,
        /**
         * O nó raiz da visualização vertical inicia expandido.
         *
         * Por isso:
         * - depth === 0 → exibe "−";
         * - demais níveis → exibem "+".
         */
        depth === 0 ? '−' : '+',
      );

      expander.type = 'button';

      expander.setAttribute(
        'aria-label',
        `Expandir unidades de ${node.name}`,
      );

      /**
       * Mantém somente o nó raiz da estrutura vertical
       * expandido no carregamento inicial.
       *
       * depth === 0:
       * Secretaria de Estado de Polícia Civil.
       *
       * Demais níveis:
       * iniciam recolhidos.
       * 
       * Para manter a Secretaria recolhida, 
       * substituir String(depth === 0) por 'false'.
       */
      expander.setAttribute(
        'aria-expanded',
        String(depth === 0),
      );

      const content = el(
        'div',
        'vbranch',
        holder,
      );

      /**
       * O conteúdo da raiz começa visível.
       * 
       * content.hidden = true, começa ocultado.
       *
       * Os demais níveis continuam ocultos
       * até que o usuário pressione o botão +.
       */
      content.hidden = depth !== 0;

      for (const child of node.children) {
        verticalBranch(
          child,
          content,
          depth + 1,
        );
      }

      expander.addEventListener('click', () => {
        content.hidden = !content.hidden;

        expander.textContent =
          content.hidden ? '+' : '−';

        expander.setAttribute(
          'aria-expanded',
          String(!content.hidden),
        );
      });
    }
  }

  /**
   * Constrói toda a visualização vertical
   * usando exatamente a mesma estrutura do JSON.
   */
  verticalBranch(DATA, verticalView);

  // ---------------------------------------------------------------------------
  // 12. CONECTORES SVG DO ORGANOGRAMA PRINCIPAL
  // ---------------------------------------------------------------------------

  /**
   * Namespace obrigatório para elementos SVG.
   */
  const SVG_NAMESPACE =
    'http://www.w3.org/2000/svg';

  /**
   * Desenha um caminho SVG.
   *
   * @param {string} coordinates Conteúdo do atributo "d" do path.
   */
  function wire(coordinates) {
    const path = document.createElementNS(
      SVG_NAMESPACE,
      'path',
    );

    path.setAttribute('d', coordinates);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#444');
    path.setAttribute('stroke-width', '1.6');
    path.setAttribute('stroke-linecap', 'square');

    svg.appendChild(path);
  }

  /**
   * Obtém posição e dimensão de um elemento
   * dentro do sistema de coordenadas original do organograma.
   *
   * O cálculo remove o efeito da escala atual.
   *
   * @param {HTMLElement} node Elemento do DOM.
   * @returns {{x:number,y:number,w:number,h:number}}
   */
  function bounds(node) {
    const rectangle =
      node.getBoundingClientRect();

    const chartRectangle =
      chart.getBoundingClientRect();

    return {
      x:
        (rectangle.left -
          chartRectangle.left) /
        scale,

      y:
        (rectangle.top -
          chartRectangle.top) /
        scale,

      w: rectangle.width / scale,

      h: rectangle.height / scale,
    };
  }

  /**
   * Obtém os limites de um nó pelo seu ID.
   *
   * @param {string} id ID da unidade.
   * @returns {Object|null}
   */
  function getBoundsById(id) {
    const node = chart.querySelector(
      `.node[data-id="${id}"]`,
    );

    return node ? bounds(node) : null;
  }

  /**
   * Centro horizontal de um retângulo.
   *
   * @param {Object} rectangle Retângulo.
   * @returns {number}
   */
  function centerX(rectangle) {
    return rectangle.x + rectangle.w / 2;
  }

  /**
   * Centro vertical de um retângulo.
   *
   * @param {Object} rectangle Retângulo.
   * @returns {number}
   */
  function centerY(rectangle) {
    return rectangle.y + rectangle.h / 2;
  }

  /**
   * Desenha o conector de um pai até vários filhos exibidos em linha horizontal.
   * Usado, por exemplo, em Corregedoria e Controladoria.
   *
   * @param {string} parentId ID do nó pai.
   * @param {string[]} childrenIds IDs dos nós filhos.
   */
  function fork(parentId, childrenIds) {
    const parentBounds =
      getBoundsById(parentId);

    const childrenBounds =
      childrenIds
        .map(getBoundsById)
        .filter(Boolean);

    if (
      !parentBounds ||
      !childrenBounds.length
    ) {
      return;
    }

    const childrenTopPositions =
      childrenBounds.map(
        (child) => child.y,
      );

    /**
     * Define a linha horizontal dos filhos 13 px acima do filho mais alto.
     */
    const level =
      Math.min(...childrenTopPositions) - 13;

    /**
     * Linha vertical que desce do pai até o barramento dos filhos.
     */
    wire(
      `M ${centerX(parentBounds)} ${
        parentBounds.y +
        parentBounds.h
      } V ${level}`,
    );

    /**
     * Linha horizontal que une o primeiro ao último filho.
     */
    if (childrenBounds.length > 1) {
      wire(
        `M ${centerX(
          childrenBounds[0],
        )} ${level} H ${centerX(
          childrenBounds.at(-1),
        )}`,
      );
    }

    /**
     * Pequenas linhas verticais que descem até cada filho.
     */
    for (const child of childrenBounds) {
      wire(
        `M ${centerX(
          child,
        )} ${level} V ${child.y}`,
      );
    }
  }

  /**
   * Desenha a estrutura de conectores entre uma Subsecretaria
   * e todas as unidades diretamente subordinadas exibidas em sua coluna.
   *
   * Estrutura resultante:
   *
   * SUBSECRETARIA
   *      │
   *      ├──── Unidade direta 1
   *      │
   *      ├──── Unidade direta 2
   *      │
   *      └──── Unidade direta N
   *
   * Características:
   * - o eixo vertical inicia exatamente na borda inferior da Subsecretaria;
   * - o eixo termina no centro vertical da última unidade direta;
   * - cada unidade recebe um braço horizontal;
   * - cada braço é alinhado ao centro vertical da respectiva caixa;
   * - nenhuma coordenada horizontal fixa é usada;
   * - a posição do eixo é calculada a partir da posição real dos elementos.
   *
   * @param {HTMLElement} column
   * Coluna correspondente a uma das quatro Subsecretarias.
   */
  function connectSubsecretariatChildren(column) {
    /**
     * O primeiro .node diretamente dentro da coluna
     * é a própria Subsecretaria.
     */
    const parentNode = column.querySelector(
      ':scope > .node',
    );

    /**
     * Seleciona somente os filhos DIRETOS.
     *
     * Importante:
     * unidades existentes dentro de .descendants não entram aqui,
     * pois pertencem a níveis hierárquicos inferiores.
     */
    const directNodes = [
      ...column.querySelectorAll(
        ':scope > .direct > .node',
      ),
    ];

    /**
     * Nada deve ser desenhado caso a Subsecretaria
     * ou seus filhos não estejam disponíveis.
     */
    if (
      !parentNode ||
      !directNodes.length
    ) {
      return;
    }

    /**
     * Obtém as posições reais dos elementos dentro
     * do sistema de coordenadas do organograma.
     */
    const parentBounds =
      bounds(parentNode);

    const childrenBounds =
      directNodes.map(bounds);

    /**
     * Primeiro filho direto.
     *
     * Sua posição à esquerda é utilizada para determinar
     * automaticamente o espaço existente entre o eixo
     * e as caixas subordinadas.
     */
    const firstChild =
      childrenBounds[0];

    /**
     * Último filho direto.
     */
    const lastChild =
      childrenBounds.at(-1);

    /**
     * --------------------------------------------------------------
     * POSIÇÃO HORIZONTAL DO EIXO VERTICAL
     * --------------------------------------------------------------
     *
     * O eixo fica exatamente no meio do espaço criado
     * entre a margem esquerda da Subsecretaria e a margem
     * esquerda dos filhos diretos.
     *
     * Exemplo:
     *
     * Subsecretaria começa em X = 100
     * Filho começa em X = 128
     *
     * Espaço = 28
     * Eixo = X 114
     *
     * Isso significa que, caso alteremos posteriormente
     * o recuo no CSS, o conector continuará funcionando.
     */
    const trunkX =
      parentBounds.x +
      (
        firstChild.x -
        parentBounds.x
      ) /
        2;

    /**
     * O eixo nasce exatamente na borda inferior
     * da caixa da Subsecretaria.
     */
    const trunkStartY =
      parentBounds.y +
      parentBounds.h;

    /**
     * O eixo termina exatamente no centro vertical
     * do último filho direto.
     */
    const trunkEndY =
      centerY(lastChild);

    /**
     * Desenha o eixo vertical.
     */
    wire(
      `M ${trunkX} ${trunkStartY} V ${trunkEndY}`,
    );

    /**
     * --------------------------------------------------------------
     * BRAÇOS HORIZONTAIS
     * --------------------------------------------------------------
     *
     * Para cada filho direto:
     *
     * eixo vertical ───── caixa
     *
     * O Y utilizado é exatamente o centro vertical da caixa,
     * garantindo alinhamento visual perfeito.
     */
    for (const child of childrenBounds) {
      const childCenterY =
        centerY(child);

      wire(
        `M ${trunkX} ${childCenterY} H ${child.x}`,
      );
    }
  }

  /**
   * Desenha os conectores entre qualquer nó hierárquico
   * e seus filhos visíveis no organograma principal.
   *
   * Exemplo:
   *
   * Departamento-Geral
   *      │
   *      ├──── Instituto 1
   *      │
   *      ├──── Instituto 2
   *      │
   *      ├──── Coordenadoria 1
   *      │
   *      └──── Coordenadoria 2
   *
   * A mesma função funciona recursivamente para níveis ainda mais profundos.
   *
   * IMPORTANTE:
   * Esta função trabalha somente com os elementos VISÍVEIS
   * no organograma principal.
   *
   * A árvore completa continua sendo obtida do JSON para os modais.
   *
   * @param {HTMLElement} wrapper
   * Container do nó pai.
   *
   * Pode ser:
   * - .direct
   * - .branch
   */
  function connectNestedChildren(wrapper) {
    /**
     * Nó visual do órgão pai.
     *
     * Exemplo:
     * Departamento-Geral de Polícia Técnico-Científica.
     */
    const parentNode = wrapper.querySelector(
      ':scope > .node',
    );

    /**
     * Container que agrupa os filhos visíveis.
     */
    const descendantsContainer = wrapper.querySelector(
      ':scope > .descendants',
    );

    /**
     * Se o órgão não possuir descendentes visíveis,
     * não há nada para conectar.
     */
    if (
      !parentNode ||
      !descendantsContainer
    ) {
      return;
    }

    /**
     * Recupera somente os filhos DIRETOS deste órgão.
     *
     * Há dois formatos possíveis:
     *
     * 1. filho real:
     *
     * .branch
     *   └── .node
     *
     * 2. nó-resumo:
     *
     * .summary-node
     *
     * Exemplo:
     * "Delegacias Distritais"
     */
    const childNodes = [
      ...descendantsContainer.querySelectorAll(
        ':scope > .branch > .node, :scope > .summary-node',
      ),
    ];

    if (!childNodes.length) {
      return;
    }

    /**
     * Obtém a geometria do pai e dos filhos
     * dentro das coordenadas originais do organograma.
     */
    const parentBounds =
      bounds(parentNode);

    const childrenBounds =
      childNodes.map(bounds);

    /**
     * Primeiro filho.
     *
     * Sua posição horizontal permite descobrir automaticamente
     * o espaço existente entre o pai e seus descendentes.
     */
    const firstChild =
      childrenBounds[0];

    /**
     * Último filho.
     */
    const lastChild =
      childrenBounds.at(-1);

    /**
     * ================================================================
     * POSIÇÃO DO EIXO VERTICAL
     * ================================================================
     *
     * O eixo é colocado no meio do espaço entre:
     *
     * - a borda esquerda do pai;
     * - a borda esquerda dos filhos.
     *
     * Portanto, nenhuma coordenada fixa precisa ser mantida no JS.
     */
    const trunkX =
      parentBounds.x +
      (
        firstChild.x -
        parentBounds.x
      ) /
        2;

    /**
     * O eixo começa exatamente abaixo da caixa pai.
     */
    const trunkStartY =
      parentBounds.y +
      parentBounds.h;

    /**
     * O eixo termina exatamente no centro
     * da última unidade diretamente subordinada.
     */
    const trunkEndY =
      centerY(lastChild);

    /**
     * Desenha o eixo vertical.
     */
    wire(
      `M ${trunkX} ${trunkStartY} V ${trunkEndY}`,
    );

    /**
     * ================================================================
     * CONECTORES HORIZONTAIS
     * ================================================================
     *
     * Cada filho recebe um braço horizontal:
     *
     * eixo ───── filho
     */
    for (const child of childrenBounds) {
      const childCenterY =
        centerY(child);

      wire(
        `M ${trunkX} ${childCenterY} H ${child.x}`,
      );
    }
  }

  /**
   * Percorre todos os grupos hierárquicos visíveis
   * e desenha seus conectores internos.
   *
   * Isso evita termos de cadastrar manualmente:
   *
   * - Departamento Técnico-Científico;
   * - Departamento da Capital;
   * - Departamento do Interior;
   * - DPAs;
   * - institutos;
   * - coordenadorias;
   * - futuros níveis adicionais.
   *
   * Se existir:
   *
   * pai
   * └── .descendants
   *
   * a função automaticamente desenha a estrutura.
   */
  function connectAllNestedHierarchy() {
    /**
     * .direct:
     * unidades diretamente abaixo de uma Subsecretaria.
     *
     * .branch:
     * unidades existentes em níveis hierárquicos inferiores.
     */
    const hierarchicalWrappers = [
      ...chart.querySelectorAll(
        '.direct, .branch',
      ),
    ];

    for (const wrapper of hierarchicalWrappers) {
      connectNestedChildren(wrapper);
    }
  }

  /**
   * Redesenha todos os conectores do organograma original.
   *
   * Essa função é chamada após:
   * - alteração de zoom;
   * - redimensionamento da janela;
   * - troca de visualização;
   * - carregamento das fontes.
   */
  function redraw() {
    /**
     * Na visualização vertical, os conectores SVG não são necessários.
     */
    if (
      mount.dataset.view === 'vertical'
    ) {
      return;
    }

    /**
     * Remove todos os caminhos SVG anteriores.
     */
    svg.replaceChildren();

    /**
     * Obtém a raiz e as quatro subsecretarias principais.
     */
    const root =
      getBoundsById('sepol');

    const subsecretariatIds = [
      '2',
      '3',
      '4',
      '5',
    ];

    const subsecretariats =
      subsecretariatIds
        .map(getBoundsById)
        .filter(Boolean);

    if (
      !root ||
      subsecretariats.length !== 4
    ) {
      return;
    }

    /**
     * Centro horizontal da Secretaria = eixo vertical principal.
     */
    const trunkX = centerX(root);

    /**
     * O eixo vertical termina pouco antes da linha horizontal que distribui
     * as quatro subsecretarias.
     */
    const lineEnd =
      Math.min(
        ...subsecretariats.map(
          (item) => item.y,
        ),
      ) - 20;

    /**
     * Eixo vertical central, abaixo da Secretaria.
     */
    wire(
      `M ${trunkX} ${
        root.y + root.h
      } V ${lineEnd}`,
    );

    /**
     * Conselho Superior e Chefia de Gabinete devem compartilhar exatamente
     * a mesma coordenada vertical de conexão.
     */
    const council =
      getBoundsById('6');

    const topReferenceY =
      council
        ? centerY(council)
        : null;

    /**
     * Desenha os braços laterais conectados ao eixo principal.
     */
    for (const id of [
      '6',
      '1.1',
      '1.2',
      '1.3',
      '1.4',
      '1.5',
      '1.6',
      '1.7',
      '1.8',
    ]) {
      const current =
        getBoundsById(id);

      if (!current) {
        continue;
      }

      /**
       * Ajuste solicitado:
       * a Chefia de Gabinete usa a mesma altura de conexão do Conselho.
       */
      const y =
        id === '1.1' &&
        topReferenceY !== null
          ? topReferenceY
          : centerY(current);

      if (current.x < trunkX) {
        /**
         * Nó localizado à esquerda do eixo central.
         */
        wire(
          `M ${
            current.x +
            current.w
          } ${y} H ${trunkX}`,
        );
      } else {
        /**
         * Nó localizado à direita do eixo central.
         */
        wire(
          `M ${trunkX} ${y} H ${current.x}`,
        );
      }
    }

    /**
     * Conectores próprios dos grupos laterais.
     * A geometria é calculada a partir das dimensões reais dos elementos,
     * sem comprimento fixo para os braços.
     */
    const groupedBranches = [
      [
        '1.7',
        [
          '1.7.5',
          '1.7.6',
          '1.7.7',
          '1.7.8',
        ],
      ],
      [
        '1.8',
        [
          '1.8.4',
          '1.8.5',
        ],
      ],
    ];

    for (
      const [
        parentId,
        childrenIds,
      ] of groupedBranches
    ) {
      fork(
        parentId,
        childrenIds,
      );
    }

    /**
     * Linha horizontal principal das quatro subsecretarias.
     */
    const branchY =
      subsecretariats[0].y - 18;

    wire(
      `M ${centerX(
        subsecretariats[0],
      )} ${branchY} H ${centerX(
        subsecretariats.at(-1),
      )}`,
    );

    /**
     * Linhas verticais que descem da barra horizontal até cada subsecretaria.
     */
    for (
      const subsecretariat
      of subsecretariats
    ) {
      wire(
        `M ${centerX(
          subsecretariat,
        )} ${branchY} V ${
          subsecretariat.y
        }`,
      );
    }

    /**
     * --------------------------------------------------------------
     * CONECTORES INTERNOS DAS QUATRO SUBSECRETARIAS
     * --------------------------------------------------------------
     *
     * Cada coluna passa a possuir:
     *
     * Subsecretaria
     *      │
     *      ├── unidade
     *      ├── unidade
     *      └── unidade
     *
     * Apenas os filhos diretos são considerados.
     */
    const subsecretariatColumns = [
      ...chart.querySelectorAll(
        '.subcolumn',
      ),
    ];

    for (
      const column
      of subsecretariatColumns
    ) {
      connectSubsecretariatChildren(
        column,
      );
    }

    /**
     * Desenha os conectores dos níveis hierárquicos inferiores.
     *
     * Exemplo:
     *
     * Departamento-Geral
     *      │
     *      ├── Instituto
     *      ├── Instituto
     *      └── Coordenadoria
     */
    connectAllNestedHierarchy();

    /**
     * Calcula a altura real total do organograma com base nas colunas inferiores.
     */
    const fullHeight =
      Math.ceil(
        Math.max(
          ...[
            ...chart.querySelectorAll(
              '.subcolumn',
            ),
          ].map((column) => {
            const rectangle =
              bounds(column);

            return (
              rectangle.y +
              rectangle.h
            );
          }),
        ),
      ) + 35;

    /**
     * Ajusta a altura física do chart.
     */
    chart.style.height =
      `${fullHeight}px`;

    /**
     * Mantém o SVG sincronizado com o tamanho do organograma.
     */
    svg.setAttribute(
      'viewBox',
      `0 0 1480 ${fullHeight}`,
    );

    svg.setAttribute(
      'width',
      '1480',
    );

    svg.setAttribute(
      'height',
      String(fullHeight),
    );

    adjustStage();
  }

  // ---------------------------------------------------------------------------
  // 13. CONTROLE DE ZOOM
  // ---------------------------------------------------------------------------

  /**
   * Atualiza dimensões do stage e aplica transform: scale() ao gráfico.
   */
  function adjustStage() {
    const chartWidth = 1480;
    const chartHeight =
      chart.offsetHeight;

    stage.style.width =
      `${chartWidth * scale}px`;

    stage.style.height =
      `${chartHeight * scale}px`;

    chart.style.transform =
      `scale(${scale})`;

    mount.querySelector(
      '.zoom-value',
    ).textContent =
      `${Math.round(
        scale * 100,
      )}%`;
  }

  /**
   * Define uma nova escala respeitando os limites mínimos e máximos.
   *
   * @param {number} newScale Nova escala solicitada.
   */
  function setScale(newScale) {
    scale = Math.max(
      0.35,
      Math.min(
        1.5,
        Math.round(
          newScale * 100,
        ) / 100,
      ),
    );

    adjustStage();
    redraw();
  }

  /**
   * Zoom +
   */
  mount
    .querySelector('.zoom-in')
    .addEventListener(
      'click',
      () => {
        setScale(
          scale + 0.15,
        );
      },
    );

  /**
   * Zoom −
   */
  mount
    .querySelector('.zoom-out')
    .addEventListener(
      'click',
      () => {
        setScale(
          scale - 0.15,
        );
      },
    );

  /**
   * Ajusta automaticamente o organograma à largura disponível.
   */
  mount
    .querySelector('.zoom-reset')
    .addEventListener(
      'click',
      () => {
        setScale(
          Math.min(
            1,
            (
              viewport.clientWidth -
              12
            ) / 1480,
          ),
        );

        viewport.scrollTo({
          left: 0,
          top: 0,
        });
      },
    );

  // ---------------------------------------------------------------------------
  // 14. ALTERNÂNCIA ENTRE ORGANOGRAMA ORIGINAL E VISUALIZAÇÃO VERTICAL
  // ---------------------------------------------------------------------------

  const originalViewButton =
    mount.querySelector(
      '.show-original',
    );

  const verticalViewButton =
    mount.querySelector(
      '.show-vertical',
    );

  /**
   * Troca a visualização ativa.
   *
   * @param {'original'|'vertical'} view Tipo de visualização.
   */
  function changeView(view) {
    mount.dataset.view = view;

    originalViewButton.setAttribute(
      'aria-pressed',
      String(
        view === 'original',
      ),
    );

    verticalViewButton.setAttribute(
      'aria-pressed',
      String(
        view === 'vertical',
      ),
    );

    /**
     * Ao voltar para o organograma original,
     * redesenha os conectores.
     */
    if (view === 'original') {
      requestAnimationFrame(
        () => {
          redraw();

          /**
           * Em smartphones, centraliza aproximadamente o eixo principal.
           */
          if (
            matchMedia(
              '(max-width: 767px)',
            ).matches
          ) {
            viewport.scrollLeft =
              Math.max(
                0,
                740 * scale -
                  viewport.clientWidth /
                    2,
              );

            viewport.scrollTop = 0;
          }
        },
      );
    }
  }

  originalViewButton.addEventListener(
    'click',
    () => {
      changeView('original');
    },
  );

  verticalViewButton.addEventListener(
    'click',
    () => {
      changeView('vertical');
    },
  );

  // ---------------------------------------------------------------------------
  // 15. REDIMENSIONAMENTO RESPONSIVO
  // ---------------------------------------------------------------------------

  /**
   * ID do frame de animação usado para evitar
   * múltiplos redraw() simultâneos.
   */
  let frame = 0;

  /**
   * Agenda um único redesenho para o próximo animation frame.
   */
  const reschedule = () => {
    cancelAnimationFrame(frame);

    frame =
      requestAnimationFrame(
        redraw,
      );
  };

  /**
   * ResizeObserver acompanha alterações no tamanho
   * do viewport do organograma.
   */
  new ResizeObserver(
    reschedule,
  ).observe(viewport);

  /**
   * Também reage ao redimensionamento global da janela.
   */
  window.addEventListener(
    'resize',
    reschedule,
  );

  /**
   * Aguarda o carregamento das fontes antes
   * do redesenho definitivo,
   * porque mudanças métricas na tipografia
   * alteram as posições dos conectores.
   */
  document.fonts?.ready.then(
    reschedule,
  );

  // ---------------------------------------------------------------------------
  // 16. ESTADO INICIAL RESPONSIVO
  // ---------------------------------------------------------------------------

  if (
    matchMedia(
      '(max-width: 767px)',
    ).matches
  ) {
    /**
     * Em smartphones, inicia pela visualização vertical simplificada.
     * O usuário continua podendo alternar para o organograma original.
     */
    changeView('vertical');

    setScale(0.75);
  } else {
    /**
     * Em telas maiores, inicia pelo organograma original
     * e ajusta a escala à largura disponível,
     * sem ultrapassar 100%.
     */
    setScale(
      Math.min(
        1,
        (
          viewport.clientWidth -
          12
        ) / 1480,
      ),
    );
  }

  /**
   * Garante um redesenho final após toda a montagem inicial.
   */
  requestAnimationFrame(
    redraw,
  );
})();
