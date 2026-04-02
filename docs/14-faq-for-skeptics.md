<!--
  document: 14-faq-for-skeptics.md
  title: FAQ for Skeptics
  description: Substantive answers to common concerns from experienced developers
    who are skeptical about AI coding tools
  audience: experienced developers evaluating or resistant to AI coding assistance
  last_updated: 2026-04-02
  toolkit_version: 1.0
  depends_on:
    - 01-what-is-this-toolkit.md
    - 02-how-it-works.md
    - 08-prompt-engineering.md
    - 12-capabilities-and-limitations.md
-->

# FAQ for Skeptics

If you are an experienced developer and skeptical of AI coding tools, this page is
for you. These are not softball questions with marketing answers. They are actual
objections raised by senior engineers who have seen hype cycles before, addressed
with the honesty those objections deserve. Every answer acknowledges the validity of
the concern before explaining how the toolkit addresses it -- or acknowledging that
it does not fully solve it.

For a broader capability assessment, see
[Capabilities and Limitations](12-capabilities-and-limitations.md).

---

## 1. "Doesn't AI just generate buggy code?"

Yes, it can. Anyone who has used a generic AI coding assistant on a mature codebase
has experienced code that compiles but violates every convention the team established.
This is a legitimate concern.

The *type* of bugs matters, though. Generic AI tools produce bugs at every level --
wrong patterns, wrong imports, wrong file structures, wrong error handling. The
toolkit eliminates an entire category by giving the AI specific knowledge of this
project's conventions. When `api-routes.mdc` specifies that decorators must follow a
specific top-to-bottom order, the AI does not invent its own. When
`api-error-handling.mdc` specifies `raise_flask_error()` with `ValidationErrorDetail`,
the AI does not return ad-hoc JSON error responses.

What the toolkit does not fix is business logic bugs. If you ask the AI to implement
grant eligibility calculations, it will guess wrong, because eligibility rules come
from program officers and statutory authority, not code patterns. See "What the AI Is
Bad At" in [Capabilities and Limitations](12-capabilities-and-limitations.md). Your
review burden shifts from structural to logic correctness -- meaningful, not a silver
bullet.

---

## 2. "Why would I trust code I didn't write?"

You should not trust it blindly. That is the correct instinct. But consider: you
already trust code you did not write every day -- framework code, library code, code
from teammates whose PRs you reviewed. The issue is not authorship but
*verifiability*. You trust those other sources because you can inspect them, test
them, and reason about them.

AI-generated code is verifiable in the same ways. The toolkit makes verification
easier because the rules are explicit and inspectable. If the AI generates a route
handler, you can open `api-routes.mdc` and confirm the output follows the documented
pattern. The rules serve as a contract you can check output against.

The workflow: generate the code, read every line, run the test suite, diff against an
existing file following the same pattern. If you cannot explain what a generated line
does, do not commit it. As stated in
[What Is This Toolkit?](01-what-is-this-toolkit.md): "If you use the toolkit to
generate code you do not understand, you are creating a maintenance problem." For
prompt strategies producing more verifiable output, see
[Prompt Engineering](08-prompt-engineering.md).

---

## 3. "Won't this make developers lazy?"

This assumes that manually typing boilerplate is what makes a developer rigorous. It
is not -- understanding what the code does is. Consider what a senior developer does
when adding a new endpoint: they open an existing endpoint as reference, copy the
structure, modify names and logic, check the decorator order, create the service
file, and write tests. The intellectual work is in design decisions, not mechanical
reproduction of patterns.

The toolkit handles the mechanical reproduction. The developer still decides what the
endpoint does, what the schema looks like, what validation rules apply, and how the
service layer interacts with the database. The toolkit frees developers to spend more
time on the parts that require actual engineering judgment.

There is a legitimate version of this concern: a junior developer might never learn
*why* patterns exist if they only use AI to reproduce them. The mitigation is
cultural -- teams should ensure developers understand conventions, not just follow
them. The toolkit includes PR references in every rule so developers can trace a
convention to the decision that established it.

---

## 4. "How is this different from GitHub Copilot?"

Copilot has broad knowledge of languages and frameworks. What it does not know is
how *this team* uses Flask and Next.js. Copilot generates a valid route handler. The
toolkit generates one with this project's decorator ordering, service layer
delegation, `raise_flask_error()`, and `db_session` as the first parameter.

The toolkit achieves this through 18 auto-activating domain rules, 15 code snippets,
6 notepads, and 3 MCP servers -- project-specific context that does not exist in
generic tools. For the full architecture, see [How It Works](02-how-it-works.md).

The comparison in [Capabilities and Limitations](12-capabilities-and-limitations.md)
is concrete: vanilla Cursor generates a database model with integer PKs and generic
patterns, while the toolkit produces UUID primary keys, `TimestampMixin`, `Mapped[T]`
syntax, and singular table names -- conventions from `api-database.mdc`. The
difference between "valid code" and "code that belongs in this codebase" is what
project-specific rules provide.

---

## 5. "What about security? AI code could have vulnerabilities."

This concern is entirely valid, and the toolkit does not solve it. Security review
is still required for every change, regardless of authorship.

The `api-auth.mdc` rule encodes the existing JWT + API key multi-auth pattern, and
the AI reproduces it reliably. What the AI cannot do is evaluate whether a new
endpoint needs different authorization or whether a change introduces privilege
escalation. [Capabilities and Limitations](12-capabilities-and-limitations.md) rates
auth logic at "Low" AI reliability: "Always -- do not trust AI for security."

The toolkit helps indirectly with consistency -- `raise_flask_error()` prevents
information leakage through inconsistent error formats, and defaulting to React
Server Components reduces client-side attack surface. These are indirect benefits,
not a replacement for security review.

---

## 6. "I've tried AI coding tools and they were terrible."

That experience is common. Generic AI tools fail on mature codebases because they
lack project-specific context -- code valid by framework documentation but wrong by
team conventions. After generating, failing review, and rewriting, most developers
conclude the tool is a net negative.

Project-specific rules address the root cause. These rules were extracted from 1,459
merged pull requests from the actual Simpler.Grants.gov repository, including review
comments where reviewers corrected violations. The auto-activation mechanism means
you do not paste context manually -- open a file in `api/src/api/` and the API rules
load via glob matching. This is where previous AI workflows broke down.

The toolkit will still disappoint in specific situations -- complex business logic,
large refactors, architectural judgment. The difference is honest boundaries. See
[Capabilities and Limitations](12-capabilities-and-limitations.md) and
[Prompt Engineering](08-prompt-engineering.md) for techniques that improve results.

---

## 7. "Does this replace code review?"

Absolutely not. What changes is what reviewers spend time on. Without the toolkit,
reviewers catch both structural issues (wrong decorator order, missing `downgrade()`,
client hooks in server components) and logic issues (incorrect business rules, missing
edge cases). With the toolkit, structural issues are prevented at authoring time, so
reviewers focus on logic requiring human judgment.

The PR review skill is a *pre-review*, not a replacement. It runs domain-specific
checklists based on which files changed. The human reviewer focuses on what the AI
cannot answer: Is the business logic correct? Is this the right architecture? Think
of it as a convention linter -- you would not consider ESLint a replacement for code
review, and the PR review skill operates in the same category.

---

## 8. "What if the rules are wrong?"

They might be. The rules were generated by analyzing 1,459 merged PRs and validated
by team members, but that process is not perfect. A pattern from 40 PRs might have
been deprecated by a single architectural decision. A convention correct six months
ago may have been superseded.

Every rule is a plain text `.mdc` file in `.cursor/rules/` you can read in minutes.
Every directive references the PRs it was extracted from, so you can trace any rule
to its source. If a rule conflicts with what a senior developer tells you, the senior
developer is right -- update the rule and open a PR.

The extraction pipeline is repeatable via `research/refresh.sh`. A team that
re-extracts quarterly will have more accurate rules than one that never updates.
If you find a wrong rule, fix it like any other code change.

---

## 9. "Will this work for complex features?"

For features that are structurally complex but conventionally standard -- a new
endpoint touching seven files, a form with the three-schema architecture -- the
toolkit handles scaffolding well. The agents like `agent-new-endpoint` are designed
for these multi-file, convention-heavy tasks.

For *logically* complex features -- eligibility algorithms, workflow engines,
reporting with complex aggregations -- the toolkit provides the structural shell but
not the logic. You get correctly structured files and test scaffolding; the
implementation comes from you.

For features both structurally novel and logically complex -- new architectural
patterns, integrations not matching existing patterns -- the toolkit provides limited
value. It encodes existing patterns, not new ones. The AI will try to force novel
work into existing patterns, which may be wrong. Consult the task reliability table
in [Capabilities and Limitations](12-capabilities-and-limitations.md) before
deciding whether to use AI for a particular task.

---

## 10. "How do I know the AI isn't hallucinating?"

Hallucination is dangerous because hallucinated code looks correct. Function names
are plausible, patterns recognizable, but details -- an import that does not exist,
a method not on that class -- are fabricated.

The toolkit reduces structural hallucination by constraining the AI's output space.
When rules specify exact decorator orders, file locations, and import paths with
concrete examples, the AI reproduces documented patterns rather than inventing.
Business logic hallucination is different -- the AI produces confident, specific,
wrong answers for domain-specific calculations.

Practical strategies: diff against existing files; check that every import resolves;
run the test suite (import and attribute errors signal hallucination); question any
number or formula you did not provide. If the AI produces something unexpected,
assume wrong until confirmed. For prompt techniques, see
[Prompt Engineering](08-prompt-engineering.md).

---

## 11. "What about the learning curve?"

If you already use Cursor, the toolkit requires no new workflows. Auto-activating
rules load via file globs without action on your part. Snippets use standard VS Code
tab-completion with an `sgg-` prefix. MCP servers run in the background. The only
new concept is notepads -- optional reference documents you attach to a conversation.

If you are new to Cursor, the learning curve is Cursor itself, not the toolkit.
Cursor is a VS Code fork, so the editor is familiar. The toolkit adds
project-specific intelligence without requiring a new tool or new workflows.

The agents have a slightly higher learning curve because you need to know they exist.
But each is self-documenting -- invoke it and it asks the questions it needs, walking
you through the workflow step by step. Most developers are productive within an hour
of setup because the complexity is in the rules, not the configuration.

---

## 12. "Is this just a fad?"

Pragmatically: AI coding assistance is not going away, but specific tools will
evolve. The trajectory has been consistent -- increasingly capable models,
increasingly specific project-level customization. Even if Cursor is replaced next
year, the principle that project-specific context produces better results than
generic assistance will remain. The rules are plain text adaptable to any tool.

What will change is how rules are maintained. Today the extraction pipeline runs as a
batch process. In the future, extraction may be continuous. But the need for
project-specific context persists because every mature codebase has conventions
differing from framework defaults.

The honest risk is that tooling investment may need refreshing as platforms evolve.
The toolkit mitigates this: rules are format-agnostic text, the pipeline is
repeatable, and no component creates lock-in. The intellectual investment transfers
even if file formats change.

---

## 13. "What data does this send to external services?"

The toolkit itself -- `.mdc` rule files, snippets, notepads -- is entirely local
plain text. The MCP servers run as local processes: GitHub MCP calls the GitHub API
(which you already use), Filesystem MCP reads local files, and
`simpler-grants-context` MCP provides structured codebase data. All communicate
with Cursor over stdin/stdout locally.

Cursor itself sends prompts and code context to AI model providers (Anthropic and
OpenAI) to generate responses -- Cursor's core functionality, not the toolkit's.
Cursor offers Privacy Mode preventing code from being used for training. The toolkit
adds no telemetry or external API calls beyond what Cursor already does.

If you disable the MCP servers, the remaining components are entirely offline. For
technical details, see [How It Works](02-how-it-works.md).

---

## 14. "Can I use this without the MCP servers?"

Yes. The 18 rules, 15 snippets, 6 notepads, 6 agents, and PR review skill are all
local text files requiring no connectivity. Remove the MCP servers (edit
`.cursor/mcp.json`) and you lose live GitHub fetching and extended file access. You
retain all project-specific conventions and workflow guidance.

MCP servers are most valuable during extended sessions where the AI needs files you
do not have open. If your workflow is transactional, they add less value. Start
without them and enable later if you want more context in conversations.

---

## 15. "What if I disagree with a convention the AI enforces?"

**If the rule is wrong:** edit the `.mdc` file in `.cursor/rules/`, update the
directive, open a PR. Rule changes should involve developers in the affected domain
since they change what the AI generates for everyone on the team.

**If you need to deviate for a specific case:** tell the AI "ignore the standard
pattern for this file because [reason]." Auto-activating rules are strong defaults,
but explicit conversation instructions take precedence. Document the deviation in a
code comment so reviewers understand why the file differs from convention.

**If you disagree with the convention itself:** that is a team discussion, not a
toolkit issue. The toolkit encodes existing conventions -- it does not create them.
Propose changes through your normal process. Once the convention changes, update the
rule. The `agent-ADR` agent can help draft an Architecture Decision Record if
warranted. Rules are descriptive of team decisions, not prescriptive from an external
authority.

---

## 16. "What happens when the AI confidently does the wrong thing?"

Confident incorrectness is harder to catch than obvious errors. The AI generates
code that looks authoritative even when details are fabricated. For structural
patterns, the toolkit mitigates this -- when rules specify "ALWAYS use UUID primary
keys," the AI follows reliably and you verify compliance quickly.

For business logic, the AI produces plausible-but-wrong implementations. The
`calculate_award_ceiling` example from
[Capabilities and Limitations](12-capabilities-and-limitations.md) illustrates this
-- the AI invents a formula that looks authoritative but is fabricated.

The defense: the rules encode *how* to write code, not *what* the code should do. If
the AI generates domain-specific logic without explicit requirements, it is guessing.
Verify assumptions against requirements documents, question numbers you did not
provide, and run code against known-correct test cases.

---

## 17. "Isn't this just a complicated linter?"

A linter checks code after it is written. The toolkit informs code *as it is being
written* -- preventing errors rather than flagging them. The decorator order is
correct in the generated output rather than corrected after the fact. Both are
valuable and complementary.

The toolkit goes beyond what linters express. Linters enforce syntactic rules and
simple patterns. The toolkit encodes architectural conventions (thin route handlers,
service delegation), workflow knowledge (which files to create for a new endpoint),
and cross-domain consistency (naming spanning backend, frontend, and database). No
linter expresses "when adding a form field, update the form schema, Marshmallow
field, database column, and translation key."

If you already have a linter catching specific conventions, the toolkit adds less
value for those patterns. Its value is highest for conventions too complex for
linting rules -- multi-file workflows, architectural patterns, cross-domain naming.

---

## 18. "How do I convince my team to try this?"

Do not convince everyone at once. Pick a structurally repetitive task well-covered by
the rules -- adding a new API endpoint is canonical. Do the task with the toolkit,
note time and review iterations, compare against typical experience.

Share results honestly: "I scaffolded a new endpoint; it got decorator order, service
convention, and test structure right on the first attempt. I still wrote the business
logic and corrected one schema field type. Saved about 30 minutes." Specific, honest
assessments persuade experienced developers more than promotional material.

If a teammate has a bad experience, investigate. Check whether the relevant rule
exists and is accurate. Fix gaps. The toolkit improves as rules improve, and real
usage is the best way to find problems.

---

## Still Skeptical?

That is fine. Skepticism is a professional virtue. If you want to evaluate on your
own terms, read the rule files in `.cursor/rules/`. They are plain text. Assess
whether they accurately represent the project's conventions without installing
anything. If the rules are accurate, the toolkit has value. If not, the rules need
fixing regardless of your opinion on AI coding tools.

---

## See Also

- [What Is This Toolkit?](01-what-is-this-toolkit.md) -- overview and all components
- [How It Works](02-how-it-works.md) -- technical architecture of rules, MCP, agents
- [Prompt Engineering](08-prompt-engineering.md) -- getting better results from AI
- [Capabilities and Limitations](12-capabilities-and-limitations.md) -- honest
  capability assessment
- [Back to documentation index](README.md)

---

*Previous: [13 -- Contributing to the Toolkit](13-contributing-to-the-toolkit.md)* |
*Next: [15 -- Glossary](15-glossary.md)*
