const STORAGE_KEY = "medcom-erp:v2";
const SESSION_KEY = "medcom-erp:session";
const DEMO_PASSWORD = "med2026";

const ROLE_LABELS = {
  ADMIN: "Administrador",
  PRESIDENT: "Presidente da Comissão",
  TREASURER: "Tesoureiro",
  FISCAL: "Conselho Fiscal",
  STUDENT: "Formando",
  AUDITOR: "Auditor",
};

const MODULES = [
  { id: "dashboard", label: "Dashboard", eyebrow: "Executivo", subtitle: "Indicadores financeiros e operacionais consolidados.", icon: "layout" },
  { id: "finance", label: "Financeiro", eyebrow: "Tesouraria", subtitle: "Receitas, despesas, plano de contas e lançamentos rastreáveis.", icon: "wallet" },
  { id: "cashflow", label: "Fluxo de caixa", eyebrow: "Projeção", subtitle: "Realizado, previsto, saldo acumulado e riscos de caixa.", icon: "activity" },
  { id: "students", label: "Formandos", eyebrow: "Relacionamento", subtitle: "Cadastro, pagamentos, inadimplência e acordos.", icon: "users" },
  { id: "events", label: "Eventos", eyebrow: "Operações", subtitle: "Orçamento, cronograma, contratos e checklist de eventos.", icon: "calendar" },
  { id: "vendors", label: "Fornecedores", eyebrow: "Contratos", subtitle: "Fornecedores, parcelas, anexos e histórico de pagamentos.", icon: "briefcase" },
  { id: "reports", label: "Relatórios", eyebrow: "Prestação de contas", subtitle: "DRE, fluxo, inadimplência, contratos e exportações.", icon: "file" },
  { id: "audit", label: "Auditoria", eyebrow: "Rastreabilidade", subtitle: "Logs de criação, edição, exclusão e alterações de valores.", icon: "shield" },
  { id: "settings", label: "Configurações", eyebrow: "Governança", subtitle: "Plano de contas, centros de custo, categorias e políticas.", icon: "settings" },
  { id: "profile", label: "Perfil", eyebrow: "Conta", subtitle: "Usuário, sessão JWT demonstrativa e permissões do perfil.", icon: "user" },
];

const ROLE_PERMISSIONS = {
  ADMIN: MODULES.map((item) => item.id),
  PRESIDENT: ["dashboard", "finance", "cashflow", "students", "events", "vendors", "reports", "audit", "profile"],
  TREASURER: ["dashboard", "finance", "cashflow", "students", "vendors", "reports", "audit", "profile"],
  FISCAL: ["dashboard", "finance", "cashflow", "students", "events", "vendors", "reports", "audit", "profile"],
  STUDENT: ["dashboard", "students", "events", "reports", "profile"],
  AUDITOR: ["dashboard", "finance", "cashflow", "students", "events", "vendors", "reports", "audit", "profile"],
};

const VIEW_META = Object.fromEntries(MODULES.map((item) => [item.id, item]));
const CURRENCY = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const SHORT_MONTH = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" });
const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

let state = loadState();
let session = loadSession();
let currentView = "dashboard";
let currentTransactionType = "RECEITA";
let toastTimer = null;

const elements = {};

boot();

function boot() {
  cacheElements();
  bindEvents();
  applyTheme();
  registerServiceWorker();

  if (session && getCurrentUser()) {
    showApp();
  } else {
    showLogin();
    loginFromUrlParams();
  }
}

function cacheElements() {
  elements.loginScreen = document.querySelector("#loginScreen");
  elements.loginForm = document.querySelector("#loginForm");
  elements.loginEmail = document.querySelector("#loginEmail");
  elements.loginPassword = document.querySelector("#loginPassword");
  elements.appShell = document.querySelector("#appShell");
  elements.sidebar = document.querySelector("#sidebar");
  elements.sideNav = document.querySelector("#sideNav");
  elements.viewRoot = document.querySelector("#viewRoot");
  elements.viewEyebrow = document.querySelector("#viewEyebrow");
  elements.viewTitle = document.querySelector("#viewTitle");
  elements.viewSubtitle = document.querySelector("#viewSubtitle");
  elements.currentUserName = document.querySelector("#currentUserName");
  elements.currentUserRole = document.querySelector("#currentUserRole");
  elements.userInitials = document.querySelector("#userInitials");
  elements.globalSearch = document.querySelector("#globalSearch");
  elements.notificationCount = document.querySelector("#notificationCount");
  elements.notificationDrawer = document.querySelector("#notificationDrawer");
  elements.notificationList = document.querySelector("#notificationList");
  elements.modalRoot = document.querySelector("#modalRoot");
  elements.toast = document.querySelector("#toast");
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", handleLogin);

  document.querySelectorAll("[data-demo-login]").forEach((button) => {
    button.addEventListener("click", () => {
      elements.loginEmail.value = button.dataset.demoLogin;
      elements.loginPassword.value = DEMO_PASSWORD;
      loginWithCredentials(elements.loginEmail.value, DEMO_PASSWORD);
    });
  });

  document.querySelector("#logoutButton").addEventListener("click", logout);
  document.querySelector("#menuToggle").addEventListener("click", () => elements.sidebar.classList.toggle("is-open"));
  document.querySelector("#themeToggle").addEventListener("click", toggleTheme);
  document.querySelector("#notificationToggle").addEventListener("click", toggleNotifications);
  document.querySelector("#closeNotifications").addEventListener("click", () => elements.notificationDrawer.classList.add("is-hidden"));
  document.querySelector("#profileShortcut").addEventListener("click", () => activateView("profile"));

  elements.sideNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) return;
    activateView(button.dataset.view);
    elements.sidebar.classList.remove("is-open");
  });

  elements.viewRoot.addEventListener("click", handleViewClick);
  elements.viewRoot.addEventListener("submit", handleViewSubmit);
  elements.viewRoot.addEventListener("input", handleViewInput);
  elements.viewRoot.addEventListener("change", handleViewChange);
  elements.modalRoot.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "print-report") window.print();
    if (event.target === elements.modalRoot || action === "close-modal") {
      closeModal();
    }
  });

  elements.globalSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      openGlobalSearch(elements.globalSearch.value);
    }
  });
}

function handleLogin(event) {
  event.preventDefault();
  loginWithCredentials(elements.loginEmail.value, elements.loginPassword.value);
}

function loginWithCredentials(email, password) {
  const user = state.users.find((item) => normalize(item.email) === normalize(email) && item.active);
  if (!user || user.passwordHash !== pseudoHash(password)) {
    showToast("Email ou senha inválidos.");
    return;
  }

  session = {
    token: createDemoJwt(user),
    userId: user.id,
    createdAt: new Date().toISOString(),
    expiresAt: addDaysISO(7),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  recordAudit("LOGIN", "User", user.id, null, { email: user.email, role: user.role }, { silent: true });
  showApp();
}

function logout() {
  const user = getCurrentUser();
  if (user) {
    recordAudit("LOGOUT", "User", user.id, { email: user.email }, null, { silent: true });
  }
  localStorage.removeItem(SESSION_KEY);
  session = null;
  showLogin();
}

function showLogin() {
  elements.loginScreen.classList.remove("is-hidden");
  elements.appShell.classList.add("is-hidden");
  elements.notificationDrawer.classList.add("is-hidden");
  elements.loginEmail.value = "admin@medcom.local";
  elements.loginPassword.value = DEMO_PASSWORD;
}

function loginFromUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const email = params.get("email");
  const password = params.get("password");
  if (!email && !password) return;

  elements.loginEmail.value = email || "admin@medcom.local";
  elements.loginPassword.value = password || "";

  if (email && password) {
    loginWithCredentials(email, password);
  }
}

function showApp() {
  elements.loginScreen.classList.add("is-hidden");
  elements.appShell.classList.remove("is-hidden");
  const user = getCurrentUser();
  elements.currentUserName.textContent = user.name;
  elements.currentUserRole.textContent = ROLE_LABELS[user.role] || user.role;
  elements.userInitials.textContent = initials(user.name);
  hydrateGeneratedNotifications();
  renderShell();
  if (!hasPermission(currentView)) currentView = "dashboard";
  renderView();
}

function renderShell() {
  const allowed = getAllowedViews();
  elements.sideNav.innerHTML = allowed
    .map((module) => `
      <button class="nav-item ${module.id === currentView ? "is-active" : ""}" type="button" data-view="${module.id}">
        <span class="nav-icon">${iconSvg(module.icon)}</span>
        <span>${module.label}</span>
        ${module.id === "audit" ? `<span class="chip">${state.auditLogs.length}</span>` : ""}
      </button>
    `)
    .join("");

  const unread = getNotifications().filter((item) => !item.read).length;
  elements.notificationCount.textContent = unread;
  elements.notificationCount.hidden = unread === 0;
  renderNotifications();
}

function activateView(view) {
  if (!hasPermission(view)) {
    showToast("Seu perfil não tem permissão para acessar este módulo.");
    return;
  }
  currentView = view;
  renderShell();
  renderView();
  elements.viewRoot.focus({ preventScroll: true });
}

function renderView() {
  const meta = VIEW_META[currentView] || VIEW_META.dashboard;
  elements.viewEyebrow.textContent = meta.eyebrow;
  elements.viewTitle.textContent = meta.label;
  elements.viewSubtitle.textContent = meta.subtitle;

  const renderers = {
    dashboard: renderDashboard,
    finance: renderFinance,
    cashflow: renderCashflow,
    students: renderStudents,
    events: renderEvents,
    vendors: renderVendors,
    reports: renderReports,
    audit: renderAudit,
    settings: renderSettings,
    profile: renderProfile,
  };

  elements.viewRoot.innerHTML = renderers[currentView]();
}

// Dashboard executivo com KPIs, gráficos e riscos inteligentes.
function renderDashboard() {
  if (getCurrentUser()?.role === "STUDENT") return renderStudentDashboard();

  const kpis = getKpis();
  const chartData = monthlySeries(6);
  const expenseByCategory = groupTransactionsBy("category", getPaidTransactions("DESPESA"));
  const activeContracts = getContracts().filter((item) => item.status === "ATIVO").length;
  const upcoming = upcomingObligations().slice(0, 6);
  const alerts = smartAlerts();

  return `
    <section class="metrics-grid">
      ${metricCard("Saldo atual", money(kpis.balance), "Conta caixa consolidada", "is-primary", kpis.balance >= 0 ? "Positivo" : "Atenção", kpis.balance >= 0 ? "" : "is-danger")}
      ${metricCard("Receitas totais", money(kpis.revenue), `${kpis.incomeCount} recebimentos pagos`, "", "+ realizado", "")}
      ${metricCard("Despesas totais", money(kpis.expense), `${kpis.expenseCount} pagamentos lançados`, "", "- realizado", "is-danger")}
      ${metricCard("Inadimplência", money(kpis.overdue), `${kpis.overdueStudents} formandos com atraso`, "", kpis.overdueStudents ? "Ação necessária" : "Em dia", kpis.overdueStudents ? "is-danger" : "")}
    </section>

    <section class="grid-12">
      <article class="panel chart-panel span-8">
        <div class="panel-heading">
          <div>
            <h2>Fluxo financeiro</h2>
            <p>Receitas, despesas e saldo dos últimos meses</p>
          </div>
          <span class="badge info">${Math.round(kpis.goalProgress)}% da meta</span>
        </div>
        ${barChart(chartData)}
      </article>

      <article class="panel span-4">
        <div class="panel-heading">
          <div>
            <h2>Despesas por categoria</h2>
            <p>Composição do realizado</p>
          </div>
        </div>
        ${donutChart(expenseByCategory)}
      </article>

      <article class="panel span-4">
        <div class="panel-heading">
          <div>
            <h2>Governança</h2>
            <p>Leitura rápida da comissão</p>
          </div>
        </div>
        <div class="mini-grid">
          ${miniStat("Contratos ativos", activeContracts)}
          ${miniStat("Eventos em execução", state.events.filter((item) => item.status !== "CONCLUIDO").length)}
          ${miniStat("Formandos", state.students.length)}
          ${miniStat("Logs de auditoria", state.auditLogs.length)}
        </div>
      </article>

      <article class="panel span-4">
        <div class="panel-heading">
          <div>
            <h2>Alertas inteligentes</h2>
            <p>Riscos financeiros e operacionais</p>
          </div>
        </div>
        <div class="smart-list">
          ${alerts.map(alertMarkup).join("")}
        </div>
      </article>

      <article class="panel span-4">
        <div class="panel-heading">
          <div>
            <h2>Próximos vencimentos</h2>
            <p>Contratos, parcelas e pagamentos</p>
          </div>
        </div>
        <div class="stack-list">
          ${upcoming.length ? upcoming.map(obligationMarkup).join("") : emptyState("Nenhum vencimento crítico nos próximos 30 dias.")}
        </div>
      </article>

      <article class="panel span-12">
        <div class="panel-heading">
          <div>
            <h2>Movimentações recentes</h2>
            <p>Últimos lançamentos registrados na tesouraria</p>
          </div>
          ${hasPermission("finance") ? `<button class="button button-secondary" type="button" data-action="go-finance">Novo lançamento</button>` : ""}
        </div>
        ${transactionsTable(state.transactions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8), { compact: true })}
      </article>
    </section>
  `;
}

function renderStudentDashboard() {
  const student = getVisibleStudentsBase()[0];
  const finance = student ? getStudentFinancials(student) : { paid: 0, open: 0, overdue: 0, status: "regular", overduePayments: [] };
  const nextPayment = student?.payments.find((payment) => payment.status !== "PAGO");
  return `
    <section class="metrics-grid">
      ${metricCard("Total pago", money(finance.paid), "Pagamentos confirmados pela comissão", "is-primary", "Recibo disponível", "")}
      ${metricCard("Em aberto", money(finance.open), "Parcelas futuras do seu plano", "", "Acompanhar", "")}
      ${metricCard("Atraso", money(finance.overdue), `${finance.overduePayments.length} parcela(s) vencida(s)`, "", finance.overdue ? "Regularizar" : "Em dia", finance.overdue ? "is-danger" : "")}
      ${metricCard("Próximo vencimento", nextPayment ? formatDate(nextPayment.dueDate) : "Quitado", nextPayment ? money(nextPayment.amount) : "Sem parcelas pendentes", "", "Plano", "")}
    </section>
    <section class="grid-12">
      <article class="panel span-7">
        <div class="panel-heading">
          <div>
            <h2>Meu acompanhamento</h2>
            <p>Status financeiro individual do formando autenticado</p>
          </div>
          ${studentStatusMarkup(finance.status)}
        </div>
        ${student ? studentsTable([student], false) : emptyState("Nenhum formando vinculado a este usuário.")}
      </article>
      <article class="panel span-5">
        <div class="panel-heading">
          <div>
            <h2>Eventos da turma</h2>
            <p>Cronograma público da comissão</p>
          </div>
        </div>
        <div class="stack-list">
          ${state.events.map((event) => `
            <div class="list-row">
              <div>
                <strong>${escapeHtml(event.name)}</strong>
                <small class="muted">${formatDate(event.date)} • ${eventStatusLabel(event.status)}</small>
              </div>
              <span class="chip">${money(event.budgetPlanned)}</span>
            </div>
          `).join("")}
        </div>
      </article>
      <article class="panel span-12">
        <div class="panel-heading">
          <div>
            <h2>Transparência</h2>
            <p>Indicadores gerais liberados para consulta dos formandos</p>
          </div>
        </div>
        <div class="stack-list">
          <div class="list-row"><span>Meta da comissão</span><strong>${money(state.settings.fundraisingGoal)}</strong></div>
          <div class="list-row"><span>Eventos cadastrados</span><strong>${state.events.length}</strong></div>
          <div class="list-row"><span>Fornecedores contratados</span><strong>${state.vendors.length}</strong></div>
        </div>
      </article>
    </section>
  `;
}

function renderFinance() {
  const userCanWrite = canWriteFinance();
  const transactions = getFilteredTransactions();
  const categories = state.categories.filter((item) => item.type === currentTransactionType);

  return `
    <section class="grid-12">
      <article class="panel span-12">
        <div class="panel-heading">
          <div>
            <h2>Controle financeiro avançado</h2>
            <p>Lançamentos obrigam plano de contas, centro de custo e status de pagamento.</p>
          </div>
          <div class="segmented-control" role="group" aria-label="Tipo de lançamento">
            ${["RECEITA", "DESPESA", "TRANSFERENCIA", "AJUSTE", "ESTORNO", "REEMBOLSO"].map((type) => `
              <button class="${type === currentTransactionType ? "is-active" : ""}" type="button" data-action="set-transaction-type" data-type="${type}">${typeLabel(type)}</button>
            `).join("")}
          </div>
        </div>

        ${userCanWrite ? `
          <form class="form-stack" id="financeForm">
            <input type="hidden" name="type" value="${currentTransactionType}" />
            <div class="form-grid">
              <label class="field">
                <span>Descrição</span>
                <input name="description" id="transactionDescription" type="text" placeholder="Ex.: BUFFET IMPERIAL LTDA" required />
              </label>
              <label class="field">
                <span>Valor</span>
                <input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required />
              </label>
              <label class="field">
                <span>Data competência</span>
                <input name="date" type="date" value="${todayISO()}" required />
              </label>
              <label class="field">
                <span>Vencimento</span>
                <input name="dueDate" type="date" value="${todayISO()}" required />
              </label>
            </div>
            <div class="form-grid">
              <label class="field">
                <span>Categoria</span>
                <select name="category" id="transactionCategory" required>
                  ${categories.map((item) => `<option value="${item.id}">${escapeHtml(item.category)}</option>`).join("")}
                </select>
              </label>
              <label class="field">
                <span>Centro de custo</span>
                <select name="costCenterId" required>
                  ${state.costCenters.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}
                </select>
              </label>
              <label class="field">
                <span>Status</span>
                <select name="status">
                  <option value="PAGO">Pago/recebido</option>
                  <option value="AGENDADO">Agendado</option>
                  <option value="PENDENTE">Pendente</option>
                </select>
              </label>
              <label class="field">
                <span>Vincular a</span>
                <select name="linkId">
                  <option value="">Sem vínculo</option>
                  ${state.events.map((item) => `<option value="event:${item.id}">Evento: ${escapeHtml(item.name)}</option>`).join("")}
                  ${state.vendors.map((item) => `<option value="vendor:${item.id}">Fornecedor: ${escapeHtml(item.name)}</option>`).join("")}
                </select>
              </label>
            </div>
            <label class="field">
              <span>Observações</span>
              <textarea name="notes" placeholder="Comprovante, conta bancária, justificativa ou regra de rateio"></textarea>
            </label>
            <div class="toolbar">
              <button class="button button-primary" type="submit">Salvar lançamento</button>
              <button class="button button-secondary" type="button" data-action="ai-categorize">Sugerir categoria com IA</button>
            </div>
          </form>
        ` : restrictedNotice("Seu perfil pode consultar os lançamentos, mas não criar movimentações financeiras.")}
      </article>

      <article class="panel span-12">
        <div class="toolbar">
          <div class="toolbar-group">
            <label class="field">
              <span>Buscar</span>
              <input id="financeSearch" type="search" value="${escapeAttribute(getFilter("financeSearch"))}" placeholder="Descrição, categoria, tag..." />
            </label>
            <label class="field">
              <span>Status</span>
              <select id="financeStatus">
                ${selectOption("TODOS", "Todos", getFilter("financeStatus", "TODOS"))}
                ${selectOption("PAGO", "Pago", getFilter("financeStatus", "TODOS"))}
                ${selectOption("AGENDADO", "Agendado", getFilter("financeStatus", "TODOS"))}
                ${selectOption("PENDENTE", "Pendente", getFilter("financeStatus", "TODOS"))}
              </select>
            </label>
            <label class="field">
              <span>Centro de custo</span>
              <select id="financeCostCenter">
                ${selectOption("TODOS", "Todos", getFilter("financeCostCenter", "TODOS"))}
                ${state.costCenters.map((item) => selectOption(item.id, item.name, getFilter("financeCostCenter", "TODOS"))).join("")}
              </select>
            </label>
          </div>
          <div class="toolbar-group">
            <button class="button button-secondary" type="button" data-action="export-finance-csv">Exportar CSV</button>
            <button class="button button-secondary" type="button" data-action="print-report">PDF</button>
          </div>
        </div>
        ${transactionsTable(transactions, { actions: userCanWrite })}
      </article>

      <article class="panel span-6">
        <div class="panel-heading">
          <div>
            <h2>Plano de contas</h2>
            <p>Categorias, subcategorias, tags e classificação</p>
          </div>
        </div>
        <div class="stack-list">
          ${state.categories.slice(0, 12).map((item) => `
            <div class="list-row">
              <div>
                <div class="list-row-title"><span class="status-dot ${item.type === "DESPESA" ? "danger" : "neutral"}"></span><strong>${escapeHtml(item.category)}</strong></div>
                <small class="muted">${typeLabel(item.type)} • ${escapeHtml(item.subcategory)} • ${item.tags.map(escapeHtml).join(", ")}</small>
              </div>
              <span class="chip">${escapeHtml(item.group)}</span>
            </div>
          `).join("")}
        </div>
      </article>

      <article class="panel span-6">
        <div class="panel-heading">
          <div>
            <h2>Centros de custo</h2>
            <p>Todo lançamento precisa estar alocado</p>
          </div>
        </div>
        <div class="stack-list">
          ${state.costCenters.map((center) => {
            const total = sum(state.transactions.filter((item) => item.costCenterId === center.id && item.type === "DESPESA").map((item) => item.amount));
            return `
              <div class="list-row">
                <div>
                  <strong>${escapeHtml(center.name)}</strong>
                  <small class="muted">${escapeHtml(center.owner)} • orçamento ${money(center.budget)}</small>
                  ${progress(total / Math.max(center.budget, 1) * 100, "var(--blue)")}
                </div>
                <strong>${money(total)}</strong>
              </div>
            `;
          }).join("")}
        </div>
      </article>
    </section>
  `;
}

function renderCashflow() {
  const series = monthlySeries(12, { projected: true });
  const projectedBalance = series.at(-1)?.balance || 0;
  const alerts = smartAlerts().filter((item) => item.kind !== "info");

  return `
    <section class="metrics-grid">
      ${metricCard("Saldo projetado", money(projectedBalance), "Considera lançamentos e parcelas futuras", "is-primary", projectedBalance >= 0 ? "Suficiente" : "Insuficiente", projectedBalance >= 0 ? "" : "is-danger")}
      ${metricCard("Entradas futuras", money(sum(series.map((item) => item.projectedIncome))), "Mensalidades e patrocínios previstos", "", "Previsto", "")}
      ${metricCard("Saídas futuras", money(sum(series.map((item) => item.projectedExpense))), "Contratos e eventos previstos", "", "Previsto", "is-danger")}
      ${metricCard("Risco financeiro", alerts.length ? `${alerts.length} alertas` : "Baixo", "Baseado em orçamento x realizado", "", alerts.length ? "Revisar" : "Ok", alerts.length ? "is-danger" : "")}
    </section>

    <section class="grid-12">
      <article class="panel span-8">
        <div class="panel-heading">
          <div>
            <h2>Fluxo realizado x projetado</h2>
            <p>Saldo acumulado por competência</p>
          </div>
        </div>
        ${lineChart(series)}
      </article>
      <article class="panel span-4">
        <div class="panel-heading">
          <div>
            <h2>Alertas de caixa</h2>
            <p>Eventos que exigem decisão</p>
          </div>
        </div>
        <div class="smart-list">
          ${alerts.length ? alerts.map(alertMarkup).join("") : emptyState("Nenhum risco crítico encontrado.")}
        </div>
      </article>
      <article class="panel span-12">
        <div class="panel-heading">
          <div>
            <h2>Detalhamento mensal</h2>
            <p>Realizado, previsto e saldo acumulado</p>
          </div>
        </div>
        ${cashflowTable(series)}
      </article>
    </section>
  `;
}

function renderStudents() {
  const students = getFilteredStudents();
  const baseStudents = getVisibleStudentsBase();
  const delinquency = students.filter((student) => getStudentFinancials(student).status === "danger");
  const agreements = students.filter((student) => student.agreement?.active);
  const canManage = hasPermission("finance") || getCurrentUser()?.role === "ADMIN";

  return `
    <section class="metrics-grid">
      ${metricCard("Formandos ativos", baseStudents.length, getCurrentUser()?.role === "STUDENT" ? "Seu cadastro financeiro" : "Base preparada para centenas de alunos", "is-primary", "Ativo", "")}
      ${metricCard("Inadimplentes", delinquency.length, "Atraso acima do limite configurado", "", delinquency.length ? "Cobrança" : "Sem atraso", delinquency.length ? "is-danger" : "")}
      ${metricCard("Acordos ativos", agreements.length, "Renegociações registradas", "", "Monitorar", "")}
      ${metricCard("A receber", money(sum(baseStudents.map((student) => getStudentFinancials(student).open))), "Parcelas pendentes totais", "", "Projetado", "")}
    </section>

    <section class="grid-12">
      <article class="panel span-12">
        <div class="toolbar">
          <div class="toolbar-group">
            <label class="field">
              <span>Buscar formando</span>
              <input id="studentSearch" type="search" value="${escapeAttribute(getFilter("studentSearch"))}" placeholder="Nome, CPF, turma..." />
            </label>
            <label class="field">
              <span>Status financeiro</span>
              <select id="studentStatus">
                ${selectOption("TODOS", "Todos", getFilter("studentStatus", "TODOS"))}
                ${selectOption("regular", "Regular", getFilter("studentStatus", "TODOS"))}
                ${selectOption("warning", "Atenção", getFilter("studentStatus", "TODOS"))}
                ${selectOption("danger", "Inadimplente", getFilter("studentStatus", "TODOS"))}
                ${selectOption("agreement", "Acordo", getFilter("studentStatus", "TODOS"))}
              </select>
            </label>
          </div>
          <div class="toolbar-group">
            <button class="button button-secondary" type="button" data-action="export-students-csv">Exportar CSV</button>
            <button class="button button-secondary" type="button" data-action="print-report">Relatório PDF</button>
          </div>
        </div>
        ${canManage ? studentForm() : restrictedNotice("Seu perfil visualiza a prestação de contas e o próprio acompanhamento financeiro.")}
      </article>
      <article class="panel span-12">
        ${studentsTable(students, canManage)}
      </article>
    </section>
  `;
}

function renderEvents() {
  const totalPlanned = sum(state.events.map((item) => item.budgetPlanned));
  const totalRealized = sum(state.events.map((item) => eventRealized(item.id)));

  return `
    <section class="metrics-grid">
      ${metricCard("Orçamento eventos", money(totalPlanned), "Previsto aprovado pela comissão", "is-primary", "Planejado", "")}
      ${metricCard("Realizado", money(totalRealized), "Despesas vinculadas aos eventos", "", `${Math.round(totalRealized / Math.max(totalPlanned, 1) * 100)}% usado`, totalRealized > totalPlanned ? "is-danger" : "")}
      ${metricCard("Eventos ativos", state.events.filter((item) => item.status !== "CONCLUIDO").length, "Cronograma em execução", "", "Operacional", "")}
      ${metricCard("Contratos vinculados", getContracts().filter((item) => item.eventId).length, "Fornecedores com evento definido", "", "Rastreado", "")}
    </section>

    <section class="grid-12">
      <article class="panel span-12">
        <div class="panel-heading">
          <div>
            <h2>Gestão de eventos</h2>
            <p>Orçamento previsto, realizado, fornecedores, checklist e cronograma.</p>
          </div>
        </div>
        <div class="module-grid">
          ${state.events.map(eventCard).join("")}
        </div>
      </article>
      <article class="panel span-12">
        <div class="panel-heading">
          <div>
            <h2>Novo evento</h2>
            <p>Cadastre pré-eventos, solenidades ou atividades da comissão</p>
          </div>
        </div>
        ${eventForm()}
      </article>
    </section>
  `;
}

function renderVendors() {
  const contracts = getContracts();
  const dueContracts = contracts.filter((item) => daysUntil(item.nextDueDate) <= 30 && item.status === "ATIVO");

  return `
    <section class="metrics-grid">
      ${metricCard("Fornecedores", state.vendors.length, "Empresas e prestadores cadastrados", "is-primary", "Base ativa", "")}
      ${metricCard("Contratos ativos", contracts.filter((item) => item.status === "ATIVO").length, "Instrumentos em vigência", "", "Jurídico", "")}
      ${metricCard("Vencem em 30 dias", dueContracts.length, "Parcelas ou revisões próximas", "", dueContracts.length ? "Atenção" : "Ok", dueContracts.length ? "is-danger" : "")}
      ${metricCard("Anexos", state.vendors.flatMap((item) => item.attachments).length, "Contratos, NFs e comprovantes", "", "Documentado", "")}
    </section>

    <section class="grid-12">
      <article class="panel span-8">
        <div class="panel-heading">
          <div>
            <h2>Fornecedores e contratos</h2>
            <p>Histórico de pagamentos, parcelas, anexos e responsáveis.</p>
          </div>
        </div>
        <div class="stack-list">
          ${state.vendors.map(vendorCard).join("")}
        </div>
      </article>
      <article class="panel span-4">
        <div class="panel-heading">
          <div>
            <h2>Cadastrar fornecedor</h2>
            <p>Upload local registra metadados do arquivo</p>
          </div>
        </div>
        ${vendorForm()}
      </article>
    </section>
  `;
}

function renderReports() {
  const kpis = getKpis();
  const dre = dreRows();

  return `
    <section class="grid-12">
      <article class="panel span-12">
        <div class="toolbar">
          <div>
            <h2>Central de relatórios</h2>
            <p class="muted">Exportações para prestação de contas, assembleia e auditoria.</p>
          </div>
          <div class="toolbar-group">
            <button class="button button-secondary" type="button" data-action="export-finance-csv">CSV financeiro</button>
            <button class="button button-secondary" type="button" data-action="export-dre-csv">Excel/DRE</button>
            <button class="button button-secondary" type="button" data-action="print-report">PDF</button>
          </div>
        </div>
      </article>

      <article class="panel span-4">
        ${miniReport("DRE simplificada", [
          ["Receitas pagas", money(kpis.revenue)],
          ["Despesas pagas", money(kpis.expense)],
          ["Resultado", money(kpis.balance)],
        ])}
      </article>
      <article class="panel span-4">
        ${miniReport("Inadimplência", [
          ["Valor em atraso", money(kpis.overdue)],
          ["Formandos em atraso", kpis.overdueStudents],
          ["Multas e juros estimados", money(kpis.overdueFees)],
        ])}
      </article>
      <article class="panel span-4">
        ${miniReport("Contratos", [
          ["Ativos", getContracts().filter((item) => item.status === "ATIVO").length],
          ["Vencem em 30 dias", upcomingObligations().filter((item) => item.kind === "Contrato").length],
          ["Valor contratado", money(sum(getContracts().map((item) => item.totalValue)))],
        ])}
      </article>

      <article class="panel span-8">
        <div class="panel-heading">
          <div>
            <h2>DRE simplificada</h2>
            <p>Receitas, despesas e resultado por grupo contábil</p>
          </div>
        </div>
        ${dreTable(dre)}
      </article>
      <article class="panel span-4">
        <div class="panel-heading">
          <div>
            <h2>Prestação de contas</h2>
            <p>Checklist operacional para assembleia</p>
          </div>
        </div>
        <div class="checklist">
          ${["Extrato bancário conciliado", "Comprovantes anexados", "Contratos revisados", "Inadimplentes notificados", "Relatório aprovado pelo Conselho Fiscal"].map((label, index) => `
            <label class="check-item"><input type="checkbox" ${index < 3 ? "checked" : ""} /> ${label}</label>
          `).join("")}
        </div>
      </article>
    </section>
  `;
}

function renderAudit() {
  const logs = state.auditLogs.slice(0, 120);
  return `
    <section class="grid-12">
      <article class="panel span-12">
        <div class="toolbar">
          <div>
            <h2>Trilha de auditoria</h2>
            <p class="muted">Registra autor, data, entidade, ação, valor anterior e valor novo.</p>
          </div>
          <button class="button button-secondary" type="button" data-action="export-audit-csv">Exportar auditoria</button>
        </div>
        <div class="data-table" style="--cols: 150px 140px minmax(160px, 1fr) minmax(160px, 1fr) minmax(180px, 1fr);">
          <div class="table-row header">
            <div>Data</div><div>Ação</div><div>Usuário</div><div>Entidade</div><div>Alteração</div>
          </div>
          ${logs.map((log) => `
            <div class="table-row">
              <div class="table-cell">${formatDateTime(log.timestamp)}</div>
              <div class="table-cell"><span class="badge ${auditBadge(log.action)}">${escapeHtml(log.action)}</span></div>
              <div class="table-cell"><strong>${escapeHtml(log.userName)}</strong><span class="subtle">${escapeHtml(ROLE_LABELS[log.role] || log.role)}</span></div>
              <div class="table-cell">${escapeHtml(log.entity)}<span class="subtle">${escapeHtml(log.recordId)}</span></div>
              <div class="table-cell">${escapeHtml(diffSummary(log))}</div>
            </div>
          `).join("")}
        </div>
      </article>
    </section>
  `;
}

function renderSettings() {
  return `
    <section class="grid-12">
      <article class="panel span-6">
        <div class="panel-heading">
          <div>
            <h2>Plano de contas dinâmico</h2>
            <p>Categorias, subcategorias, tags e grupos editáveis.</p>
          </div>
        </div>
        <form class="form-stack" id="categoryForm">
          <div class="form-grid two">
            <label class="field">
              <span>Tipo</span>
              <select name="type">
                <option value="RECEITA">Receita</option>
                <option value="DESPESA">Despesa</option>
                <option value="TRANSFERENCIA">Transferência</option>
                <option value="AJUSTE">Ajuste</option>
                <option value="ESTORNO">Estorno</option>
                <option value="REEMBOLSO">Reembolso</option>
              </select>
            </label>
            <label class="field">
              <span>Grupo</span>
              <select name="group">
                ${["Administrativo", "Eventos", "Marketing", "Produtos", "Financeiro", "Jurídico", "Tecnologia", "Operacional"].map((name) => `<option>${name}</option>`).join("")}
              </select>
            </label>
          </div>
          <div class="form-grid two">
            <label class="field">
              <span>Categoria</span>
              <input name="category" required placeholder="Ex.: Eventos" />
            </label>
            <label class="field">
              <span>Subcategoria</span>
              <input name="subcategory" required placeholder="Ex.: Baile > Open Bar" />
            </label>
          </div>
          <label class="field">
            <span>Tags</span>
            <input name="tags" placeholder="separe por vírgulas" />
          </label>
          <button class="button button-primary" type="submit">Adicionar categoria</button>
        </form>
        <div class="stack-list" style="margin-top: 16px;">
          ${state.categories.map((item) => `
            <div class="list-row">
              <div>
                <strong>${escapeHtml(item.category)} → ${escapeHtml(item.subcategory)}</strong>
                <small class="muted">${typeLabel(item.type)} • ${escapeHtml(item.group)} • ${item.tags.map(escapeHtml).join(", ")}</small>
              </div>
              <span class="chip">${item.type}</span>
            </div>
          `).join("")}
        </div>
      </article>

      <article class="panel span-6">
        <div class="panel-heading">
          <div>
            <h2>Centros de custo</h2>
            <p>Baile, colação, marketing, administrativo e centros customizados.</p>
          </div>
        </div>
        <form class="form-stack" id="costCenterForm">
          <label class="field">
            <span>Nome</span>
            <input name="name" required placeholder="Ex.: Pré-eventos" />
          </label>
          <div class="form-grid two">
            <label class="field">
              <span>Responsável</span>
              <input name="owner" required placeholder="Ex.: Diretoria de Eventos" />
            </label>
            <label class="field">
              <span>Orçamento</span>
              <input name="budget" type="number" min="0" step="0.01" required />
            </label>
          </div>
          <button class="button button-primary" type="submit">Adicionar centro</button>
        </form>
        <div class="stack-list" style="margin-top: 16px;">
          ${state.costCenters.map((item) => `
            <div class="list-row">
              <div>
                <strong>${escapeHtml(item.name)}</strong>
                <small class="muted">${escapeHtml(item.owner)}</small>
              </div>
              <strong>${money(item.budget)}</strong>
            </div>
          `).join("")}
        </div>
      </article>

      <article class="panel span-12">
        <div class="panel-heading">
          <div>
            <h2>Perfis e permissões</h2>
            <p>Controle de acesso por perfil para proteger módulos sensíveis.</p>
          </div>
        </div>
        <div class="module-grid">
          ${Object.entries(ROLE_LABELS).map(([role, label]) => `
            <div class="module-card">
              <h3>${escapeHtml(label)}</h3>
              <p class="muted">${ROLE_PERMISSIONS[role].map((view) => VIEW_META[view]?.label).filter(Boolean).join(", ")}</p>
            </div>
          `).join("")}
        </div>
      </article>
    </section>
  `;
}

function renderProfile() {
  const user = getCurrentUser();
  const tokenParts = session?.token?.split(".") || [];
  return `
    <section class="grid-12">
      <article class="panel span-5">
        <div class="panel-heading">
          <div>
            <h2>${escapeHtml(user.name)}</h2>
            <p>${escapeHtml(user.email)}</p>
          </div>
          <span class="avatar">${initials(user.name)}</span>
        </div>
        <div class="mini-grid">
          ${miniStat("Perfil", ROLE_LABELS[user.role])}
          ${miniStat("Sessão expira", formatDate(session.expiresAt))}
          ${miniStat("Módulos permitidos", getAllowedViews().length)}
          ${miniStat("Status", user.active ? "Ativo" : "Inativo")}
        </div>
      </article>
      <article class="panel span-7">
        <div class="panel-heading">
          <div>
            <h2>JWT demonstrativo</h2>
            <p>Em produção, este token deve ser emitido pelo backend Node.js e assinado com segredo seguro.</p>
          </div>
        </div>
        <div class="stack-list">
          ${tokenParts.map((part, index) => `
            <div class="list-row">
              <div>
                <strong>${["Header", "Payload", "Assinatura"][index] || "Parte"}</strong>
                <small class="muted">${escapeHtml(part)}</small>
              </div>
            </div>
          `).join("")}
        </div>
      </article>
      <article class="panel span-12">
        <div class="panel-heading">
          <div>
            <h2>Permissões do usuário</h2>
            <p>Módulos visíveis para o perfil atual.</p>
          </div>
        </div>
        <div class="module-grid">
          ${getAllowedViews().map((view) => `
            <div class="module-card">
              <span class="nav-icon">${iconSvg(view.icon)}</span>
              <h3>${view.label}</h3>
              <p class="muted">${view.subtitle}</p>
            </div>
          `).join("")}
        </div>
      </article>
    </section>
  `;
}

function handleViewClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;

  const { action } = actionTarget.dataset;
  if (action === "go-finance") activateView("finance");
  if (action === "set-transaction-type") {
    currentTransactionType = actionTarget.dataset.type;
    renderView();
  }
  if (action === "ai-categorize") suggestCategory();
  if (action === "delete-transaction") deleteTransaction(actionTarget.dataset.id);
  if (action === "mark-paid") markTransactionPaid(actionTarget.dataset.id);
  if (action === "student-receipt") openReceipt(actionTarget.dataset.id);
  if (action === "student-agreement") registerAgreement(actionTarget.dataset.id);
  if (action === "export-finance-csv") exportFinanceCsv();
  if (action === "export-students-csv") exportStudentsCsv();
  if (action === "export-dre-csv") exportDreCsv();
  if (action === "export-audit-csv") exportAuditCsv();
  if (action === "print-report") window.print();
}

function handleViewSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form.id === "financeForm") handleFinanceSubmit(event);
  if (form.id === "studentForm") handleStudentSubmit(event);
  if (form.id === "eventForm") handleEventSubmit(event);
  if (form.id === "vendorForm") handleVendorSubmit(event);
  if (form.id === "categoryForm") handleCategorySubmit(event);
  if (form.id === "costCenterForm") handleCostCenterSubmit(event);
}

function handleViewInput(event) {
  const ids = ["financeSearch", "studentSearch"];
  if (ids.includes(event.target.id)) {
    setFilter(event.target.id, event.target.value);
    renderView();
  }
}

function handleViewChange(event) {
  const ids = ["financeStatus", "financeCostCenter", "studentStatus"];
  if (ids.includes(event.target.id)) {
    setFilter(event.target.id, event.target.value);
    renderView();
  }
}

function handleFinanceSubmit(event) {
  event.preventDefault();
  if (!canWriteFinance()) return showToast("Perfil sem permissão para criar lançamentos.");
  const form = new FormData(event.target);
  const category = state.categories.find((item) => item.id === form.get("category"));
  const [linkType, linkedId] = String(form.get("linkId") || "").split(":");
  const payload = {
    id: uid("txn"),
    type: form.get("type"),
    description: clean(form.get("description")),
    amount: Number(form.get("amount")),
    date: form.get("date"),
    dueDate: form.get("dueDate"),
    paidAt: form.get("status") === "PAGO" ? form.get("date") : "",
    categoryId: category.id,
    category: category.category,
    subcategory: category.subcategory,
    group: category.group,
    costCenterId: form.get("costCenterId"),
    status: form.get("status"),
    eventId: linkType === "event" ? linkedId : "",
    vendorId: linkType === "vendor" ? linkedId : "",
    studentId: "",
    notes: clean(form.get("notes")),
    createdBy: getCurrentUser().id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!payload.description || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    showToast("Preencha descrição e valor válido.");
    return;
  }

  state.transactions.unshift(payload);
  recordAudit("CREATE", "Transaction", payload.id, null, payload);
  persist();
  renderView();
  showToast("Lançamento financeiro salvo.");
}

function handleStudentSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const amount = Number(form.get("installmentAmount"));
  const installments = Number(form.get("installments"));
  const payload = {
    id: uid("stu"),
    name: clean(form.get("name")),
    className: clean(form.get("className")),
    phone: clean(form.get("phone")),
    email: clean(form.get("email")),
    cpf: clean(form.get("cpf")),
    notes: clean(form.get("notes")),
    plan: clean(form.get("plan")),
    agreement: { active: false, notes: "" },
    payments: createPaymentSchedule(amount, installments, form.get("startMonth"), form.get("plan")),
    createdAt: new Date().toISOString(),
  };

  if (!payload.name || !payload.email || !Number.isFinite(amount) || amount <= 0) {
    showToast("Preencha os dados do formando.");
    return;
  }

  state.students.unshift(payload);
  recordAudit("CREATE", "Student", payload.id, null, payload);
  persist();
  renderView();
  showToast("Formando cadastrado.");
}

function handleEventSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = {
    id: uid("evt"),
    name: clean(form.get("name")),
    date: form.get("date"),
    status: form.get("status"),
    budgetPlanned: Number(form.get("budgetPlanned")),
    owner: clean(form.get("owner")),
    suppliers: [],
    checklist: [
      { label: "Orçamento aprovado", done: false },
      { label: "Fornecedores cotados", done: false },
      { label: "Contrato revisado", done: false },
      { label: "Cronograma divulgado", done: false },
    ],
    timeline: clean(form.get("timeline")),
  };

  if (!payload.name || !payload.date || !Number.isFinite(payload.budgetPlanned)) {
    showToast("Preencha os dados do evento.");
    return;
  }

  state.events.unshift(payload);
  recordAudit("CREATE", "Event", payload.id, null, payload);
  persist();
  renderView();
  showToast("Evento cadastrado.");
}

function handleVendorSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const files = Array.from(event.target.querySelector("input[type='file']").files || []);
  const payload = {
    id: uid("ven"),
    name: clean(form.get("name")),
    cnpj: clean(form.get("cnpj")),
    contact: clean(form.get("contact")),
    email: clean(form.get("email")),
    phone: clean(form.get("phone")),
    notes: clean(form.get("notes")),
    attachments: files.map((file) => ({ id: uid("att"), name: file.name, size: file.size, type: file.type || "arquivo", uploadedAt: new Date().toISOString() })),
    contracts: [
      {
        id: uid("ctr"),
        title: clean(form.get("contractTitle")) || "Contrato inicial",
        eventId: form.get("eventId"),
        status: "ATIVO",
        totalValue: Number(form.get("contractValue")) || 0,
        installments: Number(form.get("installments")) || 1,
        nextDueDate: form.get("nextDueDate") || todayISO(),
      },
    ],
  };

  if (!payload.name || !payload.cnpj) {
    showToast("Informe empresa e CNPJ.");
    return;
  }

  state.vendors.unshift(payload);
  recordAudit("CREATE", "Vendor", payload.id, null, payload);
  persist();
  renderView();
  showToast("Fornecedor cadastrado.");
}

function handleCategorySubmit(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = {
    id: uid("cat"),
    type: form.get("type"),
    group: clean(form.get("group")),
    category: clean(form.get("category")),
    subcategory: clean(form.get("subcategory")),
    tags: String(form.get("tags") || "").split(",").map(clean).filter(Boolean),
  };

  if (!payload.category || !payload.subcategory) {
    showToast("Informe categoria e subcategoria.");
    return;
  }

  state.categories.push(payload);
  recordAudit("CREATE", "Category", payload.id, null, payload);
  persist();
  renderView();
  showToast("Categoria adicionada.");
}

function handleCostCenterSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = {
    id: uid("cc"),
    name: clean(form.get("name")),
    owner: clean(form.get("owner")),
    budget: Number(form.get("budget")),
    active: true,
  };

  if (!payload.name || !Number.isFinite(payload.budget)) {
    showToast("Informe centro de custo e orçamento.");
    return;
  }

  state.costCenters.push(payload);
  recordAudit("CREATE", "CostCenter", payload.id, null, payload);
  persist();
  renderView();
  showToast("Centro de custo adicionado.");
}

function suggestCategory() {
  const input = document.querySelector("#transactionDescription");
  const select = document.querySelector("#transactionCategory");
  if (!input || !select) return;
  const suggestion = categorizeText(input.value, currentTransactionType);
  if (!suggestion) {
    showToast("Não encontrei sugestão para essa descrição.");
    return;
  }
  select.value = suggestion.id;
  showToast(`Sugestão: ${suggestion.category} > ${suggestion.subcategory}`);
}

function deleteTransaction(id) {
  if (!canWriteFinance()) return showToast("Perfil sem permissão para excluir.");
  const before = state.transactions.find((item) => item.id === id);
  if (!before) return;
  if (!window.confirm(`Excluir o lançamento "${before.description}"?`)) return;
  state.transactions = state.transactions.filter((item) => item.id !== id);
  recordAudit("DELETE", "Transaction", id, before, null);
  persist();
  renderView();
  showToast("Lançamento excluído.");
}

function markTransactionPaid(id) {
  if (!canWriteFinance()) return showToast("Perfil sem permissão para editar.");
  const item = state.transactions.find((entry) => entry.id === id);
  if (!item) return;
  const before = structuredClone(item);
  item.status = "PAGO";
  item.paidAt = todayISO();
  item.updatedAt = new Date().toISOString();
  recordAudit("UPDATE", "Transaction", id, before, item);
  persist();
  renderView();
  showToast("Lançamento marcado como pago.");
}

function registerAgreement(id) {
  const student = state.students.find((item) => item.id === id);
  if (!student) return;
  const before = structuredClone(student);
  student.agreement = {
    active: true,
    notes: "Acordo registrado pela tesouraria com renegociação de parcelas.",
    createdAt: new Date().toISOString(),
    createdBy: getCurrentUser().id,
  };
  recordAudit("UPDATE", "Student", id, before, student);
  persist();
  renderView();
  showToast("Acordo registrado.");
}

function openReceipt(id) {
  const student = state.students.find((item) => item.id === id);
  if (!student) return;
  const finance = getStudentFinancials(student);
  openModal(`
    <div class="modal-card">
      <p class="eyebrow">Recibo</p>
      <h2>Recibo financeiro</h2>
      <p class="muted">Comissão de Formatura Medicina 2026</p>
      <div class="stack-list" style="margin-top: 18px;">
        <div class="list-row"><strong>Formando</strong><span>${escapeHtml(student.name)}</span></div>
        <div class="list-row"><strong>CPF</strong><span>${escapeHtml(student.cpf)}</span></div>
        <div class="list-row"><strong>Total pago</strong><span>${money(finance.paid)}</span></div>
        <div class="list-row"><strong>Em aberto</strong><span>${money(finance.open)}</span></div>
        <div class="list-row"><strong>Emitido em</strong><span>${formatDate(todayISO())}</span></div>
      </div>
      <div class="modal-actions">
        <button class="button button-secondary" type="button" data-action="print-report">Imprimir/PDF</button>
        <button class="button button-primary" type="button" data-action="close-modal">Fechar</button>
      </div>
    </div>
  `);
}

function openGlobalSearch(query) {
  const term = normalize(query);
  if (term.length < 2) return showToast("Digite ao menos 2 caracteres.");
  const results = [
    ...state.students.filter((item) => normalize(`${item.name} ${item.cpf} ${item.email}`).includes(term)).map((item) => ({ type: "Formando", title: item.name, detail: item.email })),
    ...state.vendors.filter((item) => normalize(`${item.name} ${item.cnpj} ${item.contact}`).includes(term)).map((item) => ({ type: "Fornecedor", title: item.name, detail: item.cnpj })),
    ...state.transactions.filter((item) => normalize(`${item.description} ${item.category} ${item.subcategory}`).includes(term)).map((item) => ({ type: "Lançamento", title: item.description, detail: `${typeLabel(item.type)} • ${money(item.amount)}` })),
    ...state.events.filter((item) => normalize(`${item.name} ${item.owner}`).includes(term)).map((item) => ({ type: "Evento", title: item.name, detail: formatDate(item.date) })),
  ].slice(0, 20);

  openModal(`
    <div class="modal-card">
      <p class="eyebrow">Busca global</p>
      <h2>Resultados para "${escapeHtml(query)}"</h2>
      <div class="global-results" style="margin-top: 18px;">
        ${results.length ? results.map((item) => `
          <div class="list-row">
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <small class="muted">${escapeHtml(item.detail)}</small>
            </div>
            <span class="chip">${escapeHtml(item.type)}</span>
          </div>
        `).join("") : emptyState("Nada encontrado.")}
      </div>
      <div class="modal-actions">
        <button class="button button-primary" type="button" data-action="close-modal">Fechar</button>
      </div>
    </div>
  `);
}

function renderNotifications() {
  const notifications = getNotifications();
  elements.notificationList.innerHTML = notifications.length
    ? notifications.map((item) => `
      <div class="notification-item">
        <div class="list-row-title">
          <span class="status-dot ${severityClass(item.severity)}"></span>
          <strong>${escapeHtml(item.title)}</strong>
        </div>
        <p class="muted">${escapeHtml(item.message)}</p>
        <small class="muted">${formatDate(item.date)}</small>
      </div>
    `).join("")
    : emptyState("Sem notificações no momento.");
}

function toggleNotifications() {
  elements.notificationDrawer.classList.toggle("is-hidden");
  state.notifications.forEach((item) => {
    item.read = true;
  });
  persist();
  renderShell();
}

function toggleTheme() {
  state.settings.theme = document.documentElement.classList.contains("dark") ? "light" : "dark";
  persist();
  applyTheme();
}

function applyTheme() {
  document.documentElement.classList.toggle("dark", state.settings.theme === "dark");
}

function getKpis() {
  const paid = state.transactions.filter((item) => item.status === "PAGO");
  const revenue = sum(paid.filter((item) => item.type === "RECEITA" || item.type === "REEMBOLSO").map((item) => item.amount));
  const expense = sum(paid.filter((item) => item.type === "DESPESA").map((item) => item.amount));
  const studentFinancials = state.students.map(getStudentFinancials);
  const overdue = sum(studentFinancials.map((item) => item.overdue));
  return {
    revenue,
    expense,
    balance: revenue - expense,
    incomeCount: paid.filter((item) => item.type === "RECEITA" || item.type === "REEMBOLSO").length,
    expenseCount: paid.filter((item) => item.type === "DESPESA").length,
    overdue,
    overdueStudents: studentFinancials.filter((item) => item.status === "danger").length,
    overdueFees: overdue * (state.settings.fineRate / 100) + overdue * (state.settings.monthlyInterestRate / 100),
    goalProgress: revenue / Math.max(state.settings.fundraisingGoal, 1) * 100,
  };
}

function monthlySeries(count, options = {}) {
  const months = range(count).map((index) => addMonths(new Date(todayISO() + "T12:00:00"), index - (count - 4))).map(toMonthKey);
  let running = 0;
  return months.map((month) => {
    const actual = state.transactions.filter((item) => item.date.startsWith(month) && item.status === "PAGO");
    const scheduled = options.projected ? projectedForMonth(month) : { income: 0, expense: 0 };
    const income = sum(actual.filter((item) => item.type === "RECEITA" || item.type === "REEMBOLSO").map((item) => item.amount));
    const expense = sum(actual.filter((item) => item.type === "DESPESA").map((item) => item.amount));
    running += income + scheduled.income - expense - scheduled.expense;
    return {
      month,
      label: monthLabel(month),
      income,
      expense,
      projectedIncome: scheduled.income,
      projectedExpense: scheduled.expense,
      balance: running,
    };
  });
}

function projectedForMonth(month) {
  const studentIncome = sum(state.students.flatMap((student) => student.payments)
    .filter((payment) => payment.status !== "PAGO" && payment.dueDate.startsWith(month))
    .map((payment) => payment.amount));
  const scheduledTransactions = state.transactions.filter((item) => item.status !== "PAGO" && item.dueDate.startsWith(month));
  return {
    income: studentIncome + sum(scheduledTransactions.filter((item) => item.type === "RECEITA").map((item) => item.amount)),
    expense: sum(scheduledTransactions.filter((item) => item.type === "DESPESA").map((item) => item.amount)),
  };
}

function getPaidTransactions(type) {
  return state.transactions.filter((item) => item.status === "PAGO" && (!type || item.type === type));
}

function getFilteredTransactions() {
  const search = normalize(getFilter("financeSearch"));
  const status = getFilter("financeStatus", "TODOS");
  const center = getFilter("financeCostCenter", "TODOS");
  return state.transactions
    .filter((item) => !search || normalize(`${item.description} ${item.category} ${item.subcategory} ${item.group}`).includes(search))
    .filter((item) => status === "TODOS" || item.status === status)
    .filter((item) => center === "TODOS" || item.costCenterId === center)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function getFilteredStudents() {
  const search = normalize(getFilter("studentSearch"));
  const status = getFilter("studentStatus", "TODOS");
  return getVisibleStudentsBase()
    .filter((student) => !search || normalize(`${student.name} ${student.cpf} ${student.email} ${student.className}`).includes(search))
    .filter((student) => {
      if (status === "TODOS") return true;
      const finance = getStudentFinancials(student);
      if (status === "agreement") return student.agreement?.active;
      return finance.status === status;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function getVisibleStudentsBase() {
  const user = getCurrentUser();
  if (user?.role !== "STUDENT") return state.students;
  const own = state.students.find((student) => normalize(student.name) === normalize(user.name));
  return own ? [own] : [];
}

function getStudentFinancials(student) {
  const payments = student.payments || [];
  const paid = sum(payments.filter((item) => item.status === "PAGO").map((item) => item.amount));
  const open = sum(payments.filter((item) => item.status !== "PAGO").map((item) => item.amount));
  const overduePayments = payments.filter((item) => item.status !== "PAGO" && item.dueDate < todayISO());
  const overdue = sum(overduePayments.map((item) => item.amount));
  let status = "regular";
  if (overdue > 0) status = overduePayments.length > 1 ? "danger" : "warning";
  if (student.agreement?.active) status = "agreement";
  return { paid, open, overdue, status, overduePayments };
}

function getContracts() {
  return state.vendors.flatMap((vendor) => vendor.contracts.map((contract) => ({ ...contract, vendorId: vendor.id, vendorName: vendor.name })));
}

function upcomingObligations() {
  const contracts = getContracts()
    .filter((item) => item.nextDueDate && daysUntil(item.nextDueDate) >= 0 && daysUntil(item.nextDueDate) <= 30)
    .map((item) => ({ kind: "Contrato", title: item.title, owner: item.vendorName, amount: item.totalValue / Math.max(item.installments, 1), dueDate: item.nextDueDate, severity: daysUntil(item.nextDueDate) <= 7 ? "danger" : "warning" }));
  const transactions = state.transactions
    .filter((item) => item.status !== "PAGO" && item.dueDate && daysUntil(item.dueDate) >= 0 && daysUntil(item.dueDate) <= 30)
    .map((item) => ({ kind: typeLabel(item.type), title: item.description, owner: item.category, amount: item.amount, dueDate: item.dueDate, severity: daysUntil(item.dueDate) <= 7 ? "danger" : "warning" }));
  return [...contracts, ...transactions].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function smartAlerts() {
  const kpis = getKpis();
  const eventOverruns = state.events
    .map((event) => ({ event, realized: eventRealized(event.id) }))
    .filter(({ event, realized }) => realized > event.budgetPlanned * 0.9);
  const alerts = [];
  if (kpis.overdue > 0) {
    alerts.push({ title: "Inadimplência relevante", message: `${money(kpis.overdue)} em atraso. Multa e juros estimados em ${money(kpis.overdueFees)}.`, severity: "danger" });
  }
  if (kpis.goalProgress < 70) {
    alerts.push({ title: "Meta de arrecadação abaixo do ideal", message: `A comissão atingiu ${Math.round(kpis.goalProgress)}% da meta financeira.`, severity: "warning" });
  }
  eventOverruns.slice(0, 2).forEach(({ event, realized }) => {
    alerts.push({ title: `Orçamento pressionado: ${event.name}`, message: `${money(realized)} realizados de ${money(event.budgetPlanned)} previstos.`, severity: "warning" });
  });
  if (!alerts.length) {
    alerts.push({ title: "Saúde financeira estável", message: "Nenhum risco crítico foi identificado pelos critérios atuais.", severity: "success", kind: "info" });
  }
  return alerts;
}

function hydrateGeneratedNotifications() {
  const generated = [
    ...upcomingObligations().slice(0, 5).map((item) => ({
      id: `due-${item.kind}-${item.title}-${item.dueDate}`,
      title: `${item.kind} vence em ${formatDate(item.dueDate)}`,
      message: `${item.title} • ${item.owner} • ${money(item.amount)}`,
      date: item.dueDate,
      severity: item.severity,
      read: false,
    })),
    ...smartAlerts().filter((item) => item.severity !== "success").map((item, index) => ({
      id: `alert-${index}-${normalize(item.title)}`,
      title: item.title,
      message: item.message,
      date: todayISO(),
      severity: item.severity,
      read: false,
    })),
  ];

  generated.forEach((item) => {
    if (!state.notifications.some((notification) => notification.id === item.id)) {
      state.notifications.unshift(item);
    }
  });
  state.notifications = state.notifications.slice(0, 50);
  persist();
}

function getNotifications() {
  return state.notifications.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
}

function transactionsTable(transactions, options = {}) {
  if (!transactions.length) return emptyState("Nenhum lançamento encontrado.");
  return `
    <div class="data-table" style="--cols: minmax(180px, 1.4fr) 116px 130px 120px 150px ${options.actions ? "100px" : ""};">
      <div class="table-row header">
        <div>Descrição</div><div>Tipo</div><div>Categoria</div><div>Status</div><div>Valor</div>${options.actions ? "<div>Ações</div>" : ""}
      </div>
      ${transactions.map((item) => `
        <div class="table-row">
          <div class="table-cell"><strong>${escapeHtml(item.description)}</strong><span class="subtle">${formatDate(item.date)} • ${escapeHtml(costCenterName(item.costCenterId))}</span></div>
          <div class="table-cell"><span class="badge ${item.type === "DESPESA" ? "danger" : "success"}">${typeLabel(item.type)}</span></div>
          <div class="table-cell">${escapeHtml(item.category)}<span class="subtle">${escapeHtml(item.subcategory || "")}</span></div>
          <div class="table-cell"><span class="badge ${statusBadge(item.status)}">${statusLabel(item.status)}</span></div>
          <div class="table-cell amount ${item.type === "DESPESA" ? "expense" : "income"}">${money(item.amount)}</div>
          ${options.actions ? `
            <div class="row-actions">
              ${item.status !== "PAGO" ? `<button class="icon-button" type="button" title="Marcar como pago" data-action="mark-paid" data-id="${item.id}">${iconSvg("check")}</button>` : ""}
              <button class="icon-button" type="button" title="Excluir" data-action="delete-transaction" data-id="${item.id}">${iconSvg("trash")}</button>
            </div>
          ` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function studentsTable(students, canManage) {
  if (!students.length) return emptyState("Nenhum formando encontrado.");
  return `
    <div class="data-table" style="--cols: minmax(180px, 1.4fr) 120px 120px 120px 120px ${canManage ? "100px" : ""};">
      <div class="table-row header">
        <div>Formando</div><div>Status</div><div>Pago</div><div>Em aberto</div><div>Atraso</div>${canManage ? "<div>Ações</div>" : ""}
      </div>
      ${students.map((student) => {
        const finance = getStudentFinancials(student);
        return `
          <div class="table-row">
            <div class="table-cell"><strong>${escapeHtml(student.name)}</strong><span class="subtle">${escapeHtml(student.email)} • ${escapeHtml(student.className)}</span></div>
            <div class="table-cell">${studentStatusMarkup(finance.status)}</div>
            <div class="table-cell amount success">${money(finance.paid)}</div>
            <div class="table-cell">${money(finance.open)}</div>
            <div class="table-cell amount ${finance.overdue ? "danger" : ""}">${money(finance.overdue)}</div>
            ${canManage ? `
              <div class="row-actions">
                <button class="icon-button" type="button" title="Gerar recibo" data-action="student-receipt" data-id="${student.id}">${iconSvg("file")}</button>
                <button class="icon-button" type="button" title="Registrar acordo" data-action="student-agreement" data-id="${student.id}">${iconSvg("handshake")}</button>
              </div>
            ` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function studentForm() {
  return `
    <form class="form-stack" id="studentForm">
      <div class="form-grid">
        <label class="field"><span>Nome</span><input name="name" required placeholder="Nome completo" /></label>
        <label class="field"><span>Email</span><input name="email" type="email" required placeholder="email@exemplo.com" /></label>
        <label class="field"><span>Telefone</span><input name="phone" required placeholder="(00) 00000-0000" /></label>
        <label class="field"><span>CPF</span><input name="cpf" required placeholder="000.000.000-00" /></label>
      </div>
      <div class="form-grid">
        <label class="field"><span>Turma</span><input name="className" required value="Medicina 2026" /></label>
        <label class="field"><span>Plano</span><input name="plan" required value="Plano Ouro" /></label>
        <label class="field"><span>Parcelas</span><input name="installments" type="number" min="1" max="48" value="12" required /></label>
        <label class="field"><span>Valor da parcela</span><input name="installmentAmount" type="number" min="0" step="0.01" value="780" required /></label>
      </div>
      <div class="form-grid two">
        <label class="field"><span>Mês inicial</span><input name="startMonth" type="month" value="${toMonthKey(new Date(todayISO() + "T12:00:00"))}" required /></label>
        <label class="field"><span>Observações</span><input name="notes" placeholder="Bolsa, contato familiar, histórico..." /></label>
      </div>
      <button class="button button-primary" type="submit">Cadastrar formando</button>
    </form>
  `;
}

function eventCard(event) {
  const realized = eventRealized(event.id);
  const percent = realized / Math.max(event.budgetPlanned, 1) * 100;
  const contracts = getContracts().filter((item) => item.eventId === event.id);
  return `
    <article class="module-card event-card">
      <div class="panel-heading">
        <div>
          <h3>${escapeHtml(event.name)}</h3>
          <p>${formatDate(event.date)} • ${escapeHtml(event.owner)}</p>
        </div>
        <span class="badge ${event.status === "CONCLUIDO" ? "success" : "info"}">${eventStatusLabel(event.status)}</span>
      </div>
      <div class="mini-grid">
        ${miniStat("Previsto", money(event.budgetPlanned))}
        ${miniStat("Realizado", money(realized))}
      </div>
      ${progress(percent, percent > 100 ? "var(--red)" : "var(--primary)")}
      <div class="checklist">
        ${event.checklist.map((item) => `<label class="check-item"><input type="checkbox" ${item.done ? "checked" : ""} /> ${escapeHtml(item.label)}</label>`).join("")}
      </div>
      <div class="attachment-list">
        ${contracts.map((item) => `<span class="chip">${escapeHtml(item.vendorName)}</span>`).join("") || `<span class="chip">Sem fornecedor vinculado</span>`}
      </div>
    </article>
  `;
}

function eventForm() {
  return `
    <form class="form-stack" id="eventForm">
      <div class="form-grid">
        <label class="field"><span>Evento</span><input name="name" required placeholder="Ex.: Baile de Gala" /></label>
        <label class="field"><span>Data</span><input name="date" type="date" required /></label>
        <label class="field"><span>Status</span><select name="status"><option value="PLANEJAMENTO">Planejamento</option><option value="EM_EXECUCAO">Em execução</option><option value="CONCLUIDO">Concluído</option></select></label>
        <label class="field"><span>Orçamento previsto</span><input name="budgetPlanned" type="number" min="0" step="0.01" required /></label>
      </div>
      <div class="form-grid two">
        <label class="field"><span>Responsável</span><input name="owner" required placeholder="Diretoria de Eventos" /></label>
        <label class="field"><span>Cronograma</span><input name="timeline" placeholder="Marcos principais do evento" /></label>
      </div>
      <button class="button button-primary" type="submit">Cadastrar evento</button>
    </form>
  `;
}

function vendorCard(vendor) {
  return `
    <div class="module-card">
      <div class="panel-heading">
        <div>
          <h3>${escapeHtml(vendor.name)}</h3>
          <p>${escapeHtml(vendor.cnpj)} • ${escapeHtml(vendor.contact)}</p>
        </div>
        <span class="badge info">${vendor.contracts.length} contrato(s)</span>
      </div>
      <div class="stack-list">
        ${vendor.contracts.map((contract) => `
          <div class="contract-row">
            <div class="list-row-title"><strong>${escapeHtml(contract.title)}</strong><span class="badge ${contract.status === "ATIVO" ? "success" : "warning"}">${escapeHtml(contract.status)}</span></div>
            <small class="muted">${money(contract.totalValue)} • ${contract.installments} parcela(s) • próximo vencimento ${formatDate(contract.nextDueDate)}</small>
          </div>
        `).join("")}
      </div>
      <div class="attachment-list">
        ${vendor.attachments.length ? vendor.attachments.map((item) => `<span class="chip">${escapeHtml(item.name)}</span>`).join("") : `<span class="chip">Sem anexos</span>`}
      </div>
    </div>
  `;
}

function vendorForm() {
  return `
    <form class="form-stack" id="vendorForm">
      <label class="field"><span>Empresa</span><input name="name" required placeholder="Razão social" /></label>
      <label class="field"><span>CNPJ</span><input name="cnpj" required placeholder="00.000.000/0000-00" /></label>
      <label class="field"><span>Contato</span><input name="contact" required placeholder="Responsável comercial" /></label>
      <label class="field"><span>Email</span><input name="email" type="email" placeholder="contato@empresa.com" /></label>
      <label class="field"><span>Telefone</span><input name="phone" placeholder="(00) 0000-0000" /></label>
      <label class="field"><span>Contrato</span><input name="contractTitle" placeholder="Ex.: Buffet baile" /></label>
      <label class="field"><span>Evento vinculado</span><select name="eventId"><option value="">Sem evento</option>${state.events.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}</select></label>
      <div class="form-grid two">
        <label class="field"><span>Valor contratado</span><input name="contractValue" type="number" min="0" step="0.01" /></label>
        <label class="field"><span>Parcelas</span><input name="installments" type="number" min="1" value="1" /></label>
      </div>
      <label class="field"><span>Próximo vencimento</span><input name="nextDueDate" type="date" /></label>
      <label class="field"><span>Anexos</span><input name="attachments" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.doc,.docx" /></label>
      <label class="field"><span>Observações</span><textarea name="notes"></textarea></label>
      <button class="button button-primary" type="submit">Salvar fornecedor</button>
    </form>
  `;
}

function cashflowTable(series) {
  return `
    <div class="data-table" style="--cols: 110px 130px 130px 130px 130px 130px;">
      <div class="table-row header"><div>Mês</div><div>Receitas</div><div>Despesas</div><div>Entrada prevista</div><div>Saída prevista</div><div>Saldo</div></div>
      ${series.map((item) => `
        <div class="table-row">
          <div class="table-cell"><strong>${escapeHtml(item.label)}</strong></div>
          <div class="table-cell amount income">${money(item.income)}</div>
          <div class="table-cell amount expense">${money(item.expense)}</div>
          <div class="table-cell">${money(item.projectedIncome)}</div>
          <div class="table-cell">${money(item.projectedExpense)}</div>
          <div class="table-cell amount ${item.balance >= 0 ? "success" : "danger"}">${money(item.balance)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function dreRows() {
  const paid = state.transactions.filter((item) => item.status === "PAGO");
  const groups = groupBy(paid, "group");
  return Object.entries(groups).map(([group, transactions]) => {
    const revenue = sum(transactions.filter((item) => item.type === "RECEITA" || item.type === "REEMBOLSO").map((item) => item.amount));
    const expense = sum(transactions.filter((item) => item.type === "DESPESA").map((item) => item.amount));
    return { group, revenue, expense, result: revenue - expense };
  }).sort((a, b) => a.group.localeCompare(b.group, "pt-BR"));
}

function dreTable(rows) {
  return `
    <div class="data-table" style="--cols: minmax(140px, 1fr) 140px 140px 140px;">
      <div class="table-row header"><div>Grupo</div><div>Receitas</div><div>Despesas</div><div>Resultado</div></div>
      ${rows.map((item) => `
        <div class="table-row">
          <div class="table-cell"><strong>${escapeHtml(item.group)}</strong></div>
          <div class="table-cell amount income">${money(item.revenue)}</div>
          <div class="table-cell amount expense">${money(item.expense)}</div>
          <div class="table-cell amount ${item.result >= 0 ? "success" : "danger"}">${money(item.result)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function miniReport(title, rows) {
  return `
    <div class="panel-heading">
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p>Resumo gerencial</p>
      </div>
    </div>
    <div class="stack-list">
      ${rows.map(([label, value]) => `<div class="list-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
    </div>
  `;
}

function metricCard(label, value, hint, extraClass = "", trend = "", trendClass = "") {
  return `
    <article class="metric ${extraClass}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <div class="metric-row">
        <small>${escapeHtml(hint)}</small>
        ${trend ? `<em class="trend ${trendClass}">${escapeHtml(trend)}</em>` : ""}
      </div>
    </article>
  `;
}

function miniStat(label, value) {
  return `<div class="mini-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function barChart(data) {
  const max = Math.max(1, ...data.flatMap((item) => [item.income, item.expense]));
  return `
    <div class="bar-chart" style="--bars: ${data.length};">
      ${data.map((item) => `
        <div class="bar-group" title="${escapeHtml(item.label)}">
          <div class="bars">
            <span style="height: ${Math.max(4, item.income / max * 100)}%; --bar: var(--green);"></span>
            <span style="height: ${Math.max(4, item.expense / max * 100)}%; --bar: var(--red);"></span>
          </div>
          <div class="bar-label">${escapeHtml(item.label)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function lineChart(data) {
  const values = data.map((item) => item.balance);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const width = 640;
  const height = 260;
  const pad = 32;
  const points = values.map((value, index) => {
    const x = pad + (index / Math.max(values.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / Math.max(max - min, 1)) * (height - pad * 2);
    return [x, y];
  });
  const path = points.map(([x, y], index) => `${index ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const zeroY = height - pad - ((0 - min) / Math.max(max - min, 1)) * (height - pad * 2);
  return `
    <div class="line-chart">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Saldo acumulado projetado">
        <path d="M ${pad} ${zeroY.toFixed(1)} L ${width - pad} ${zeroY.toFixed(1)}" stroke="var(--line)" stroke-width="2" />
        <path d="${path}" fill="none" stroke="var(--primary)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        ${points.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="var(--primary)" />`).join("")}
        ${data.map((item, index) => {
          const x = pad + (index / Math.max(data.length - 1, 1)) * (width - pad * 2);
          return `<text x="${x.toFixed(1)}" y="${height - 8}" text-anchor="middle" fill="var(--muted)" font-size="12">${escapeHtml(item.label.split(" ")[0])}</text>`;
        }).join("")}
      </svg>
    </div>
  `;
}

function donutChart(entriesObject) {
  const entries = Object.entries(entriesObject).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const total = sum(entries.map(([, value]) => value));
  if (!total) return emptyState("Sem despesas realizadas.");
  const colors = ["var(--primary)", "var(--blue)", "var(--amber)", "var(--red)", "var(--violet)", "var(--cyan)"];
  let cursor = 0;
  const segments = entries.map(([, value], index) => {
    const start = cursor;
    const end = cursor + value / total * 100;
    cursor = end;
    return `${colors[index]} ${start}% ${end}%`;
  }).join(", ");
  return `
    <div class="donut-wrap">
      <div class="donut" style="--segments: ${segments};" aria-hidden="true"></div>
      <div class="stack-list">
        ${entries.map(([label, value], index) => `
          <div class="list-row">
            <div class="list-row-title"><span class="status-dot" style="background: ${colors[index]}"></span><strong>${escapeHtml(label)}</strong></div>
            <span>${money(value)}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function progress(value, color) {
  return `<div class="progress" style="--value: ${Math.max(0, Math.min(value, 100))}%; --bar-color: ${color};"><span></span></div>`;
}

function alertMarkup(alert) {
  return `
    <div class="smart-item">
      <div class="list-row-title">
        <span class="status-dot ${severityClass(alert.severity)}"></span>
        <strong>${escapeHtml(alert.title)}</strong>
      </div>
      <small class="muted">${escapeHtml(alert.message)}</small>
    </div>
  `;
}

function obligationMarkup(item) {
  return `
    <div class="list-row">
      <div>
        <div class="list-row-title"><span class="status-dot ${severityClass(item.severity)}"></span><strong>${escapeHtml(item.title)}</strong></div>
        <small class="muted">${escapeHtml(item.kind)} • ${escapeHtml(item.owner)} • ${formatDate(item.dueDate)}</small>
      </div>
      <strong>${money(item.amount)}</strong>
    </div>
  `;
}

function studentStatusMarkup(status) {
  const labels = {
    regular: ["Regular", "success"],
    warning: ["Atenção", "warning"],
    danger: ["Inadimplente", "danger"],
    agreement: ["Acordo", "info"],
  };
  const [label, klass] = labels[status] || labels.regular;
  return `<span class="badge ${klass}">${label}</span>`;
}

function restrictedNotice(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function getAllowedViews() {
  const user = getCurrentUser();
  const allowed = ROLE_PERMISSIONS[user?.role] || [];
  return MODULES.filter((module) => allowed.includes(module.id));
}

function hasPermission(view) {
  const user = getCurrentUser();
  return Boolean(user && (ROLE_PERMISSIONS[user.role] || []).includes(view));
}

function canWriteFinance() {
  const role = getCurrentUser()?.role;
  return ["ADMIN", "TREASURER", "PRESIDENT"].includes(role);
}

function getCurrentUser() {
  return state.users.find((user) => user.id === session?.userId && user.active);
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.schema === "medcom-erp") return parsed;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return createSeedState();
}

function loadSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!parsed || parsed.expiresAt < todayISO()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function recordAudit(action, entity, recordId, before, after, options = {}) {
  const user = getCurrentUser() || state.users[0];
  state.auditLogs.unshift({
    id: uid("log"),
    timestamp: new Date().toISOString(),
    action,
    entity,
    recordId,
    userId: user.id,
    userName: user.name,
    role: user.role,
    before: before ? auditSnapshot(before) : null,
    after: after ? auditSnapshot(after) : null,
  });
  state.auditLogs = state.auditLogs.slice(0, 500);
  if (!options.silent) persist();
}

function auditSnapshot(value) {
  return JSON.parse(JSON.stringify(value, (key, current) => {
    if (key === "passwordHash") return undefined;
    if (Array.isArray(current) && current.length > 8) return `${current.length} registros`;
    return current;
  }));
}

function diffSummary(log) {
  if (log.action === "CREATE") return "Registro criado";
  if (log.action === "DELETE") return "Registro excluído";
  if (log.action === "LOGIN") return "Sessão iniciada";
  if (log.action === "LOGOUT") return "Sessão encerrada";
  const before = log.before || {};
  const after = log.after || {};
  const changes = Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  return changes.length ? changes.slice(0, 4).join(", ") : "Sem alteração material";
}

function createSeedState() {
  const users = [
    user("usr-admin", "Ana Beatriz Rocha", "admin@medcom.local", "ADMIN"),
    user("usr-president", "Luísa Mendonça", "presidencia@medcom.local", "PRESIDENT"),
    user("usr-treasurer", "Rafael Nogueira", "tesouraria@medcom.local", "TREASURER"),
    user("usr-fiscal", "Marina Duarte", "fiscal@medcom.local", "FISCAL"),
    user("usr-student", "Camila Torres", "aluna@medcom.local", "STUDENT"),
    user("usr-auditor", "Eduardo Salles", "auditoria@medcom.local", "AUDITOR"),
  ];
  const costCenters = [
    costCenter("cc-baile", "Baile", "Diretoria de Eventos", 780000),
    costCenter("cc-colacao", "Colação", "Presidência", 160000),
    costCenter("cc-saudade", "Aula da Saudade", "Diretoria Acadêmica", 42000),
    costCenter("cc-culto", "Culto/Missa", "Diretoria de Cerimonial", 28000),
    costCenter("cc-marketing", "Marketing", "Comunicação", 36000),
    costCenter("cc-admin", "Administrativo", "Secretaria", 52000),
    costCenter("cc-produtos", "Produtos", "Comercial", 68000),
    costCenter("cc-comissao", "Comissão", "Diretoria Executiva", 84000),
  ];
  const categories = seedCategories();
  const students = generateStudents(72);
  const events = seedEvents();
  const vendors = seedVendors(events);
  const transactions = seedTransactions(students, categories, costCenters, events, vendors);
  return {
    schema: "medcom-erp",
    version: 1,
    settings: {
      theme: "light",
      fundraisingGoal: 1250000,
      fineRate: 2,
      monthlyInterestRate: 1,
      committeeName: "Comissão de Formatura Medicina 2026",
    },
    users,
    costCenters,
    categories,
    students,
    events,
    vendors,
    transactions,
    notifications: [
      { id: "ntf-seed-1", title: "Prestação de contas mensal", message: "Relatório financeiro de maio pronto para conferência.", date: "2026-05-18", severity: "info", read: false },
    ],
    auditLogs: seedAudit(users),
    filters: {},
  };
}

function user(id, name, email, role) {
  return { id, name, email, role, active: true, passwordHash: pseudoHash(DEMO_PASSWORD), createdAt: "2026-01-05T12:00:00.000Z" };
}

function costCenter(id, name, owner, budget) {
  return { id, name, owner, budget, active: true };
}

function seedCategories() {
  return [
    category("cat-mensalidade", "RECEITA", "Financeiro", "Mensalidades", "Plano mensal", ["formandos", "recorrente"]),
    category("cat-adesao", "RECEITA", "Financeiro", "Taxa adesão", "Entrada inicial", ["formandos"]),
    category("cat-rifas", "RECEITA", "Produtos", "Rifas", "Campanhas", ["arrecadacao"]),
    category("cat-festas", "RECEITA", "Eventos", "Festas", "Pré-eventos", ["bilheteria"]),
    category("cat-patrocinio", "RECEITA", "Marketing", "Patrocínios", "Cotas comerciais", ["parcerias"]),
    category("cat-produtos", "RECEITA", "Produtos", "Produtos", "Kits e camisetas", ["vendas"]),
    category("cat-rendimento", "RECEITA", "Financeiro", "Rendimentos financeiros", "Aplicações", ["banco"]),
    category("cat-buffet", "DESPESA", "Eventos", "Baile", "Buffet", ["buffet", "baile"]),
    category("cat-openbar", "DESPESA", "Eventos", "Baile", "Open Bar", ["bar", "bebidas"]),
    category("cat-decoracao", "DESPESA", "Eventos", "Baile", "Decoração", ["decoracao"]),
    category("cat-foto", "DESPESA", "Eventos", "Fotografia", "Cobertura", ["foto", "video"]),
    category("cat-colacao", "DESPESA", "Eventos", "Colação", "Cerimonial", ["colacao"]),
    category("cat-marketing", "DESPESA", "Marketing", "Marketing", "Tráfego e design", ["social"]),
    category("cat-juridico", "DESPESA", "Jurídico", "Jurídico", "Contratos", ["advocacia"]),
    category("cat-bancario", "DESPESA", "Financeiro", "Bancário", "Tarifas", ["banco"]),
    category("cat-tecnologia", "DESPESA", "Tecnologia", "Tecnologia", "Sistemas", ["software"]),
    category("cat-admin", "DESPESA", "Administrativo", "Administrativo", "Operacional", ["secretaria"]),
    category("cat-transferencia", "TRANSFERENCIA", "Financeiro", "Transferência", "Entre contas", ["banco", "caixa"]),
    category("cat-ajuste", "AJUSTE", "Financeiro", "Ajuste", "Correção contábil", ["conciliação"]),
    category("cat-estorno", "ESTORNO", "Financeiro", "Estorno", "Cancelamento", ["reversão"]),
    category("cat-reembolso", "REEMBOLSO", "Financeiro", "Reembolso", "Devoluções", ["ajuste"]),
  ];
}

function category(id, type, group, categoryName, subcategory, tags) {
  return { id, type, group, category: categoryName, subcategory, tags };
}

function generateStudents(count) {
  const first = ["Camila", "João", "Mariana", "Pedro", "Letícia", "Rafael", "Bianca", "Gabriel", "Larissa", "Henrique", "Beatriz", "Lucas", "Sofia", "Daniel", "Isabela", "Matheus", "Carolina", "Gustavo"];
  const last = ["Torres", "Medeiros", "Almeida", "Nogueira", "Duarte", "Ferreira", "Barbosa", "Azevedo", "Ribeiro", "Cardoso", "Vieira", "Moura", "Costa", "Rezende", "Santos", "Farias", "Rocha", "Lopes"];
  return range(count).map((index) => {
    const name = `${first[index % first.length]} ${last[(index * 3) % last.length]}`;
    const amount = [720, 780, 840, 920][index % 4];
    const payments = createPaymentSchedule(amount, 12, "2026-01", index % 3 === 0 ? "Plano Integral" : "Plano Ouro");
    payments.forEach((payment, paymentIndex) => {
      if (paymentIndex < 4 && index % 7 !== 0) {
        payment.status = "PAGO";
        payment.paidAt = addDays(payment.dueDate, index % 4);
      }
      if (paymentIndex === 4 && index % 5 === 0) {
        payment.status = "PAGO";
        payment.paidAt = addDays(payment.dueDate, 1);
      }
    });
    return {
      id: uid("stu"),
      name,
      className: "Medicina 2026",
      phone: `(31) 9${String(80000000 + index * 13791).slice(0, 8)}`,
      email: `${normalize(name).replace(/\s+/g, ".")}@alunos.med.br`,
      cpf: `${String(10000000000 + index * 91731).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`,
      notes: index % 9 === 0 ? "Solicitou contato por WhatsApp antes de cobranças formais." : "",
      plan: index % 3 === 0 ? "Plano Integral" : "Plano Ouro",
      agreement: { active: index % 17 === 0, notes: index % 17 === 0 ? "Renegociação aprovada pela tesouraria." : "" },
      payments,
      createdAt: "2026-01-05T12:00:00.000Z",
    };
  });
}

function createPaymentSchedule(amount, installments, startMonth, plan) {
  const [year, month] = String(startMonth).split("-").map(Number);
  return range(installments).map((index) => {
    const due = new Date(year, month - 1 + index, 10, 12);
    return {
      id: uid("pay"),
      installment: index + 1,
      plan,
      amount,
      dueDate: localDateISO(due),
      status: "PENDENTE",
      paidAt: "",
    };
  });
}

function seedEvents() {
  return [
    { id: "evt-baile", name: "Baile de Gala", date: "2026-12-12", status: "EM_EXECUCAO", budgetPlanned: 780000, owner: "Diretoria de Eventos", suppliers: [], checklist: checklist([1, 1, 1, 0, 0]), timeline: "Contrato, degustação, mapa de mesas e execução." },
    { id: "evt-colacao", name: "Colação de Grau", date: "2026-12-08", status: "PLANEJAMENTO", budgetPlanned: 160000, owner: "Presidência", suppliers: [], checklist: checklist([1, 1, 0, 0, 0]), timeline: "Cerimonial, becas, roteiro e ensaio." },
    { id: "evt-saudade", name: "Aula da Saudade", date: "2026-11-20", status: "PLANEJAMENTO", budgetPlanned: 42000, owner: "Diretoria Acadêmica", suppliers: [], checklist: checklist([1, 0, 0, 0, 0]), timeline: "Auditório, homenagens, vídeo e coffee break." },
    { id: "evt-churrasco", name: "Churrasco Pré-baile", date: "2026-09-19", status: "EM_EXECUCAO", budgetPlanned: 38000, owner: "Diretoria Social", suppliers: [], checklist: checklist([1, 1, 0, 0, 0]), timeline: "Ingressos, atrações e segurança." },
  ];
}

function checklist(done) {
  const labels = ["Orçamento aprovado", "Fornecedores cotados", "Contrato revisado", "Pagamentos programados", "Checklist operacional fechado"];
  return labels.map((label, index) => ({ label, done: Boolean(done[index]) }));
}

function seedVendors(events) {
  return [
    vendor("ven-buffet", "Buffet Imperial LTDA", "12.345.678/0001-90", "Helena Castro", "evt-baile", "Buffet e jantar do baile", 312000, "2026-06-10", ["contrato-buffet.pdf", "nf-entrada-buffet.pdf"]),
    vendor("ven-openbar", "Prime Open Bar Serviços", "22.111.444/0001-08", "Caio Martins", "evt-baile", "Open bar premium", 186000, "2026-06-25", ["contrato-openbar.pdf"]),
    vendor("ven-foto", "Memória Viva Foto e Filme", "09.222.333/0001-17", "Nina Lopes", "evt-colacao", "Cobertura foto e vídeo", 74000, "2026-07-05", ["proposta-foto.pdf"]),
    vendor("ven-cerimonial", "Elegance Cerimonial", "31.555.120/0001-60", "Patrícia Lima", "evt-colacao", "Cerimonial e protocolo", 94000, "2026-06-18", ["contrato-cerimonial.pdf"]),
    vendor("ven-juridico", "Duarte & Reis Advocacia", "44.100.220/0001-11", "Dr. André Reis", "", "Assessoria jurídica", 18000, "2026-06-03", ["contrato-juridico.pdf"]),
  ];
}

function vendor(id, name, cnpj, contact, eventId, title, totalValue, nextDueDate, files) {
  return {
    id,
    name,
    cnpj,
    contact,
    email: `${normalize(name).split(" ")[0]}@fornecedor.com.br`,
    phone: "(31) 3333-0000",
    notes: "",
    attachments: files.map((name) => ({ id: uid("att"), name, size: 384000, type: "application/pdf", uploadedAt: "2026-05-10T10:00:00.000Z" })),
    contracts: [{ id: uid("ctr"), title, eventId, status: "ATIVO", totalValue, installments: 6, nextDueDate }],
  };
}

function seedTransactions(students, categories, costCenters, events, vendors) {
  const byId = Object.fromEntries(categories.map((item) => [item.id, item]));
  const transactions = [];
  students.forEach((student) => {
    student.payments.filter((payment) => payment.status === "PAGO").forEach((payment) => {
      transactions.push(transaction({
        type: "RECEITA",
        description: `Mensalidade ${student.name}`,
        amount: payment.amount,
        date: payment.paidAt,
        dueDate: payment.dueDate,
        category: byId["cat-mensalidade"],
        costCenterId: "cc-comissao",
        status: "PAGO",
        studentId: student.id,
      }));
    });
  });
  [
    ["Patrocínio Cooperativa Médica", 46000, "2026-03-20", "cat-patrocinio", "cc-marketing"],
    ["Rifa jaleco bordado", 18500, "2026-04-15", "cat-rifas", "cc-produtos"],
    ["Festa do Internato", 38500, "2026-05-05", "cat-festas", "cc-comissao"],
    ["Venda de camisetas", 12300, "2026-05-12", "cat-produtos", "cc-produtos"],
    ["Rendimento aplicação CDB", 3120, "2026-05-15", "cat-rendimento", "cc-comissao"],
  ].forEach(([description, amount, date, categoryId, center]) => {
    transactions.push(transaction({ type: byId[categoryId].type, description, amount, date, dueDate: date, category: byId[categoryId], costCenterId: center, status: "PAGO" }));
  });
  [
    ["Entrada Buffet Imperial LTDA", 52000, "2026-04-02", "2026-04-02", "cat-buffet", "cc-baile", "evt-baile", "ven-buffet", "PAGO"],
    ["Parcela Buffet Imperial LTDA", 52000, "2026-05-10", "2026-05-10", "cat-buffet", "cc-baile", "evt-baile", "ven-buffet", "PAGO"],
    ["Open Bar sinal", 31000, "2026-05-18", "2026-05-25", "cat-openbar", "cc-baile", "evt-baile", "ven-openbar", "AGENDADO"],
    ["Decoração palco e ambientação", 44000, "2026-06-12", "2026-06-12", "cat-decoracao", "cc-baile", "evt-baile", "", "AGENDADO"],
    ["Assessoria jurídica contratos", 6000, "2026-05-03", "2026-05-03", "cat-juridico", "cc-admin", "", "ven-juridico", "PAGO"],
    ["Sistema financeiro e hospedagem", 4200, "2026-05-06", "2026-05-06", "cat-tecnologia", "cc-admin", "", "", "PAGO"],
    ["Tráfego campanha patrocínio", 3200, "2026-05-08", "2026-05-08", "cat-marketing", "cc-marketing", "", "", "PAGO"],
    ["Cerimonial colação parcela", 18800, "2026-06-18", "2026-06-18", "cat-colacao", "cc-colacao", "evt-colacao", "ven-cerimonial", "AGENDADO"],
    ["Cobertura foto e vídeo entrada", 14800, "2026-05-14", "2026-05-14", "cat-foto", "cc-colacao", "evt-colacao", "ven-foto", "PAGO"],
  ].forEach(([description, amount, date, dueDate, categoryId, center, eventId, vendorId, status]) => {
    transactions.push(transaction({ type: "DESPESA", description, amount, date, dueDate, category: byId[categoryId], costCenterId: center, eventId, vendorId, status }));
  });
  return transactions.sort((a, b) => b.date.localeCompare(a.date));
}

function transaction(input) {
  return {
    id: uid("txn"),
    type: input.type,
    description: input.description,
    amount: input.amount,
    date: input.date,
    dueDate: input.dueDate,
    paidAt: input.status === "PAGO" ? input.date : "",
    categoryId: input.category.id,
    category: input.category.category,
    subcategory: input.category.subcategory,
    group: input.category.group,
    costCenterId: input.costCenterId,
    status: input.status,
    eventId: input.eventId || "",
    vendorId: input.vendorId || "",
    studentId: input.studentId || "",
    notes: "",
    createdBy: "usr-treasurer",
    createdAt: "2026-05-18T12:00:00.000Z",
    updatedAt: "2026-05-18T12:00:00.000Z",
  };
}

function seedAudit(users) {
  return [
    { id: uid("log"), timestamp: "2026-05-18T12:30:00.000Z", action: "CREATE", entity: "Report", recordId: "dre-maio", userId: users[2].id, userName: users[2].name, role: users[2].role, before: null, after: { name: "DRE maio" } },
    { id: uid("log"), timestamp: "2026-05-17T16:10:00.000Z", action: "UPDATE", entity: "Contract", recordId: "ven-buffet", userId: users[1].id, userName: users[1].name, role: users[1].role, before: { nextDueDate: "2026-06-05" }, after: { nextDueDate: "2026-06-10" } },
    { id: uid("log"), timestamp: "2026-05-16T09:45:00.000Z", action: "CREATE", entity: "Transaction", recordId: "seed-openbar", userId: users[2].id, userName: users[2].name, role: users[2].role, before: null, after: { amount: 31000, status: "AGENDADO" } },
  ];
}

function categorizeText(text, type) {
  const normalized = normalize(text);
  const rules = [
    [/buffet|jantar|imperial|coquetel/, "cat-buffet"],
    [/open\s?bar|bebida|bar|chopp|cerveja/, "cat-openbar"],
    [/decor|flores|ambientacao|palco/, "cat-decoracao"],
    [/foto|filme|video|album/, "cat-foto"],
    [/colacao|cerimonial|beca/, "cat-colacao"],
    [/advoc|jurid|contrato/, "cat-juridico"],
    [/banco|tarifa|pix|ted/, "cat-bancario"],
    [/sistema|software|hosting|tecnologia|dominio/, "cat-tecnologia"],
    [/patrocin|cota|parceria/, "cat-patrocinio"],
    [/rifa|sorteio/, "cat-rifas"],
    [/mensalidade|parcela|formando/, "cat-mensalidade"],
  ];
  const found = rules.find(([regex]) => regex.test(normalized));
  if (found) return state.categories.find((item) => item.id === found[1]);
  return state.categories.find((item) => item.type === type);
}

function exportFinanceCsv() {
  const rows = [["tipo", "data", "vencimento", "status", "categoria", "subcategoria", "centro_custo", "descricao", "valor"], ...getFilteredTransactions().map((item) => [
    typeLabel(item.type),
    item.date,
    item.dueDate,
    statusLabel(item.status),
    item.category,
    item.subcategory,
    costCenterName(item.costCenterId),
    item.description,
    numberForCsv(item.amount),
  ])];
  downloadCsv("financeiro-medcom.csv", rows);
}

function exportStudentsCsv() {
  const rows = [["nome", "turma", "email", "telefone", "cpf", "plano", "status", "pago", "aberto", "atraso"], ...getFilteredStudents().map((student) => {
    const finance = getStudentFinancials(student);
    return [student.name, student.className, student.email, student.phone, student.cpf, student.plan, finance.status, numberForCsv(finance.paid), numberForCsv(finance.open), numberForCsv(finance.overdue)];
  })];
  downloadCsv("formandos-medcom.csv", rows);
}

function exportDreCsv() {
  const rows = [["grupo", "receitas", "despesas", "resultado"], ...dreRows().map((item) => [item.group, numberForCsv(item.revenue), numberForCsv(item.expense), numberForCsv(item.result)])];
  downloadCsv("dre-medcom.csv", rows);
}

function exportAuditCsv() {
  const rows = [["data", "acao", "usuario", "perfil", "entidade", "registro", "alteracao"], ...state.auditLogs.map((log) => [log.timestamp, log.action, log.userName, ROLE_LABELS[log.role], log.entity, log.recordId, diffSummary(log)])];
  downloadCsv("auditoria-medcom.csv", rows);
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");
  downloadText(filename, `\ufeff${csv}`, "text/csv;charset=utf-8");
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function openModal(html) {
  elements.modalRoot.innerHTML = html;
  elements.modalRoot.classList.remove("is-hidden");
}

function closeModal() {
  elements.modalRoot.classList.add("is-hidden");
  elements.modalRoot.innerHTML = "";
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
}

function typeLabel(type) {
  return {
    RECEITA: "Receita",
    DESPESA: "Despesa",
    TRANSFERENCIA: "Transferência",
    AJUSTE: "Ajuste",
    ESTORNO: "Estorno",
    REEMBOLSO: "Reembolso",
  }[type] || type;
}

function statusLabel(status) {
  return { PAGO: "Pago", AGENDADO: "Agendado", PENDENTE: "Pendente" }[status] || status;
}

function eventStatusLabel(status) {
  return { PLANEJAMENTO: "Planejamento", EM_EXECUCAO: "Em execução", CONCLUIDO: "Concluído" }[status] || status;
}

function statusBadge(status) {
  return status === "PAGO" ? "success" : status === "AGENDADO" ? "warning" : "info";
}

function auditBadge(action) {
  return action === "DELETE" ? "danger" : action === "UPDATE" ? "warning" : action === "LOGIN" ? "info" : "success";
}

function severityClass(severity) {
  return { danger: "danger", warning: "warning", info: "neutral", success: "" }[severity] || "";
}

function costCenterName(id) {
  return state.costCenters.find((item) => item.id === id)?.name || "Sem centro";
}

function eventRealized(eventId) {
  return sum(state.transactions.filter((item) => item.eventId === eventId && item.type === "DESPESA").map((item) => item.amount));
}

function groupTransactionsBy(key, transactions) {
  return transactions.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + item.amount;
    return acc;
  }, {});
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "Sem grupo";
    acc[value] = acc[value] || [];
    acc[value].push(item);
    return acc;
  }, {});
}

function getFilter(name, fallback = "") {
  return state.filters?.[name] ?? fallback;
}

function setFilter(name, value) {
  state.filters = state.filters || {};
  state.filters[name] = value;
  persist();
}

function selectOption(value, label, selected) {
  return `<option value="${escapeAttribute(value)}" ${String(selected) === String(value) ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function money(value) {
  return CURRENCY.format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  return DATE.format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function formatDateTime(value) {
  return DATE_TIME.format(new Date(value));
}

function monthLabel(month) {
  return SHORT_MONTH.format(new Date(`${month}-02T12:00:00`)).replace(".", "");
}

function todayISO() {
  return localDateISO(new Date());
}

function localDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysISO(days) {
  return addDays(todayISO(), days);
}

function addDays(value, days) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateISO(date);
}

function addMonths(date, quantity) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + quantity);
  return next;
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function daysUntil(value) {
  const target = new Date(`${value}T12:00:00`);
  const today = new Date(`${todayISO()}T12:00:00`);
  return Math.ceil((target - today) / 86400000);
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function range(count) {
  return Array.from({ length: count }, (_, index) => index);
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalize(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[;"\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function numberForCsv(value) {
  return String(Number(value || 0).toFixed(2)).replace(".", ",");
}

function uid(prefix) {
  if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pseudoHash(value) {
  return btoa(unescape(encodeURIComponent(`medcom:${value}:demo`)));
}

function createDemoJwt(user) {
  const header = base64Url({ alg: "HS256", typ: "JWT", demo: true });
  const payload = base64Url({ sub: user.id, email: user.email, role: user.role, iat: Date.now(), exp: Date.now() + 7 * 86400000 });
  const signature = base64Url({ signature: pseudoHash(`${user.id}:${user.role}`) });
  return `${header}.${payload}.${signature}`;
}

function base64Url(value) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value)))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function initials(name) {
  return clean(name).split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function iconSvg(name) {
  const icons = {
    layout: '<svg viewBox="0 0 24 24"><path d="M4 5h16v5H4zM4 14h7v5H4zM15 14h5v5h-5z"/></svg>',
    wallet: '<svg viewBox="0 0 24 24"><path d="M4 7h16v12H4z"/><path d="M16 11h4v4h-4z"/><path d="M7 7V5h10v2"/></svg>',
    activity: '<svg viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24"><path d="M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1"/><path d="M3 7h18v12H3z"/><path d="M3 12h18"/></svg>',
    file: '<svg viewBox="0 0 24 24"><path d="M14 2H6v20h12V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.1-.1a1.7 1.7 0 0 0-2-.3 1.7 1.7 0 0 0-1 1.5V22h-4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-2 .3l-.1.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.4-1H3v-4h.2a1.7 1.7 0 0 0 1.4-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.1.1a1.7 1.7 0 0 0 2 .3 1.7 1.7 0 0 0 1-1.5V2h4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 2-.3l.1-.1 2 3.4-.1.1A1.7 1.7 0 0 0 19.4 9c.3.6.8 1 1.4 1h.2v4h-.2a1.7 1.7 0 0 0-1.4 1Z"/></svg>',
    user: '<svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m20 6-11 11-5-5"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>',
    handshake: '<svg viewBox="0 0 24 24"><path d="m11 17 2 2a3 3 0 0 0 4 0l3-3"/><path d="m14 14 2 2"/><path d="M3 8l4-4 5 5-4 4Z"/><path d="m7 12 5 5"/><path d="m14 5 7 7-3 3"/></svg>',
  };
  return icons[name] || icons.file;
}

function registerServiceWorker() {
  const canUseServiceWorker = "serviceWorker" in navigator && ["http:", "https:"].includes(window.location.protocol);
  if (!canUseServiceWorker) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // O sistema continua funcionando; o cache offline é apenas um aprimoramento.
    });
  });
}
