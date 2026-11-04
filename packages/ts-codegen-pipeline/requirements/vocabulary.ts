import type { RequirementStyle, StyleVocabulary } from '@frenchexdev2/requirements-shared-kernel';

/** Local vocabulary snapshot of the original DefaultStyle; no validators or runtime style dependency. */
export const PIPELINE_VOCABULARY = {
  requirementKinds: ['Functional', 'NonFunctional', 'Constraint', 'Compliance', 'UserStory'],

  statusWorkflow: {
    states: ['Draft', 'Approved', 'Implemented', 'Verified', 'Deprecated'],
    initial: 'Draft',
    transitions: [
      { from: 'Draft',       to: 'Approved' },
      { from: 'Approved',    to: 'Implemented' },
      { from: 'Implemented', to: 'Verified' },
      { from: 'Verified',    to: 'Deprecated' },
      { from: 'Approved',    to: 'Deprecated' },
      { from: 'Draft',       to: 'Deprecated' },
    ],
    terminal: ['Deprecated'],
  },

  riskTaxonomy: {
    levels: ['Critical', 'High', 'Medium', 'Low'],
  },

  verificationMethods: ['Test', 'Inspection', 'Analysis', 'Demonstration'],

  rationaleKinds: [
    'evidence-based',
    'principle',
    'value-driven',
    'regulatory-compliance',
    'risk-mitigation',
    'precedent',
  ],

  sourceKinds: [
    { kind: 'stakeholder',      label: 'Stakeholder',       slots: [
      { name: 'role', type: 'string',  required: true,  hint: 'e.g. product-team, ops, legal' },
      { name: 'date', type: 'iso-date', required: true },
    ]},
    { kind: 'regulation',       label: 'Regulation',         slots: [
      { name: 'jurisdiction', type: 'string', required: true, hint: 'EU, FR, US, …' },
      { name: 'act',          type: 'string', required: true, hint: 'GDPR, HIPAA, …' },
      { name: 'article',      type: 'string', required: false },
      { name: 'paragraph',    type: 'string', required: false },
    ]},
    { kind: 'standard',         label: 'Standard',           slots: [
      { name: 'org', type: 'string', required: true, hint: 'ISO, IEEE, W3C, NIST' },
      { name: 'id',  type: 'string', required: true, hint: 'e.g. 29148:2018' },
      { name: 'section', type: 'string', required: false },
    ]},
    { kind: 'contract',         label: 'Contract / SLA',     slots: [
      { name: 'doc',    type: 'string', required: true },
      { name: 'clause', type: 'string', required: false },
    ]},
    { kind: 'risk',             label: 'Risk register',      slots: [
      { name: 'registerEntry', type: 'string', required: true },
      { name: 'severity',      type: 'string', required: true },
    ]},
    { kind: 'business-goal',    label: 'Business goal / OKR', slots: [
      { name: 'okrId',  type: 'string', required: true },
      { name: 'period', type: 'string', required: true, hint: '2026-Q1' },
    ]},
    { kind: 'incident',         label: 'Incident / postmortem', slots: [
      { name: 'incidentId',    type: 'string',   required: true },
      { name: 'date',          type: 'iso-date', required: true },
      { name: 'postmortemUrl', type: 'url',      required: false },
    ]},
    { kind: 'domain-knowledge', label: 'Domain knowledge',   slots: [
      { name: 'reference', type: 'string', required: true },
    ]},
  ],

  // EARS (Mavin et al., Rolls-Royce, IEEE RE'09). Five canonical patterns + natural fallback.
  statementPatterns: [
    { pattern: 'ubiquitous',   label: 'Ubiquitous',   template: 'The system shall {response}.',
      slots: [ { name: 'response', required: true, hint: 'what the system does' } ] },
    { pattern: 'event-driven', label: 'Event-driven', template: 'When {trigger}, the system shall {response}.',
      slots: [
        { name: 'trigger',  required: true, hint: 'the triggering event' },
        { name: 'response', required: true, hint: 'what the system does in response' },
      ] },
    { pattern: 'state-driven', label: 'State-driven', template: 'While {state}, the system shall {response}.',
      slots: [
        { name: 'state',    required: true },
        { name: 'response', required: true },
      ] },
    { pattern: 'optional',     label: 'Optional feature', template: 'Where {feature}, the system shall {response}.',
      slots: [
        { name: 'feature',  required: true },
        { name: 'response', required: true },
      ] },
    { pattern: 'unwanted',     label: 'Unwanted behaviour', template: 'If {trigger}, then the system shall {response}.',
      slots: [
        { name: 'trigger',  required: true },
        { name: 'response', required: true },
      ] },
    { pattern: 'natural',      label: 'Natural (fallback — generates warning)', template: '{text}',
      slots: [ { name: 'text', required: true } ] },
  ],
} as const satisfies StyleVocabulary;

export type PipelineRequirementStyle = Omit<RequirementStyle, 'vocabulary'> & { readonly vocabulary: typeof PIPELINE_VOCABULARY };
