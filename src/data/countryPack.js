export const countryPack = {
  packId: 'kenya.nairobi-health-centre-v1',
  jurisdiction: 'nairobi_county',
  sourceRegistry: [
    {
      id: 'nairobi-budget-2025',
      title: 'Nairobi County Annual Development Plan 2025',
      authority: 'Nairobi City County Government',
      publicationDate: '2025-06-12',
      retrievalDate: '2026-09-19',
      quality: 'primary_authoritative'
    },
    {
      id: 'county-progress-bulletin-2026q1',
      title: 'Quarterly Progress Bulletin Q1 2026',
      authority: 'County Health Department',
      publicationDate: '2026-04-08',
      retrievalDate: '2026-09-19',
      quality: 'official_reported'
    },
    {
      id: 'independent-civic-watch-2026',
      title: 'Civic Watch Field Note #44',
      authority: 'Independent Civic Watch',
      publicationDate: '2026-08-01',
      retrievalDate: '2026-09-19',
      quality: 'credible_independent'
    }
  ],
  projects: [
    {
      projectId: 'NCC-HEALTH-017',
      name: 'Kawangware Community Health Centre Upgrade',
      locationHint: 'Kawangware Ward',
      responsibleBody: 'Nairobi City County - Health Department',
      officialStatus: 'Reported as completed in Q1 2026 bulletin',
      budgetKes: 48000000,
      paymentStatus: 'Two disbursements recorded',
      contacts: [
        {
          role: 'County Chief Officer - Health',
          route: 'healthcomplaints@nairobi.go.ke',
          verified: true,
          sourceId: 'nairobi-budget-2025',
          checkedAt: '2026-09-19'
        },
        {
          role: 'Project Officer',
          route: 'unverified-officer@example.com',
          verified: false,
          sourceId: 'county-progress-bulletin-2026q1',
          checkedAt: '2026-09-19'
        }
      ]
    }
  ],
  procedures: {
    complaint: {
      deadlineRule: 'Acknowledgement expected within 14 calendar days when submitted via official county email.',
      requiredFields: ['project reference', 'observation date', 'requested remedy']
    }
  },
  knownLimitations: ['Contract completion certificate not yet published in open portal.']
};
