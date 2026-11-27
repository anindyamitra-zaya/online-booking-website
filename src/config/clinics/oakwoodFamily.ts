import type { ClinicBundleConfig } from '../../types/clinic';

export const oakwoodFamilyConfig: ClinicBundleConfig = {
  clinic: {
    id: 'oakwood-family',
    name: 'Oakwood Family & Primary Care',
    shortName: 'Oakwood Care',
    specialty: 'Family Medicine, Preventive Wellness & Chronic Care',
    phone: '(512) 555-0315',
    supportEmail: 'care@oakwoodfamily.example',
    cancellationPolicyHours: 24,
    bannerImage: '/src/assets/images/clinic_atrium_interior.webp',
    themeColor: '#047857',
    brandAccent: 'emerald',
    reschedulePolicy: {
      lockProvider: true,
      lockLocation: false,
    },
    accommodations: [
      'Wheelchair & mobility assistance',
      'ASL sign language interpreter',
      'Large-print intake forms',
      'Sensory-friendly quiet waiting area',
    ],
    commonVisitReasons: {
      default: [
        'Annual wellness & physical',
        'Prescription refill or review',
        'Persistent cold or cough symptoms',
        'Lab results follow-up',
        'Blood pressure / diabetes check',
      ],
      byAppointmentType: {
        'type-wellness': [
          'Annual physical exam',
          'Immunization & vaccine review',
          'Preventive lab panel',
          'Health screening & lifestyle review',
        ],
      },
    },
    cancellationReasons: [
      'Schedule conflict',
      'Symptoms improved / no longer needed',
      'Need a different provider or location',
      'Transportation or travel issue',
      'Other reason',
    ],
    samplePatients: [
      {
        label: 'Established: Elena Vance',
        fullName: 'Elena Vance',
        firstName: 'Elena',
        lastName: 'Vance',
        dateOfBirth: '1984-05-14',
      },
      {
        label: 'New Patient: Jordan Taylor',
        fullName: 'Jordan Taylor',
        firstName: 'Jordan',
        lastName: 'Taylor',
        dateOfBirth: '1990-03-12',
      },
    ],
    locations: [
      {
        id: 'loc-oakwood-main',
        name: 'Oakwood Main Street Clinic',
        address: '890 Oakwood Ave, Suite 120',
        cityStateZip: 'Cedar Park, TX 78613',
        phone: '(512) 555-0315',
        hours: 'Mon–Fri 8:00 AM – 6:00 PM · Sat 9:00 AM – 1:00 PM',
        parkingNote: 'Free front-door accessible parking spaces available',
        accessibilityFeatures: [
          'Single-level step-free entry',
          'Quiet waiting alcove upon request',
        ],
      },
    ],
  },
  providers: [
    {
      id: 'prov-brooks',
      name: 'Dr. Hannah Brooks',
      credentials: 'MD, FAAFP',
      specialty: 'Family & Preventive Medicine',
      bio: 'Provides comprehensive primary care for adults, seniors, and adolescents.',
      languages: ['English', 'Spanish'],
      locationIds: ['loc-oakwood-main'],
      telehealthEnabled: true,
      nextAvailableDate: '2026-11-19',
    },
    {
      id: 'prov-cho',
      name: 'Dr. David Cho',
      credentials: 'DO',
      specialty: 'Primary Care & Diabetes Management',
      bio: 'Partners with patients on metabolic health, preventive screenings, and acute care.',
      languages: ['English', 'Korean'],
      locationIds: ['loc-oakwood-main'],
      telehealthEnabled: true,
      nextAvailableDate: '2026-11-20',
    },
  ],
  appointmentTypes: [
    {
      id: 'type-followup',
      name: 'Primary Care Follow-Up',
      durationMinutes: 30,
      description: 'Follow up on lab work, prescriptions, or ongoing symptoms.',
      telehealthAvailable: true,
      preparationInstructions: [
        'Bring a list of current prescriptions and any recent home readings.',
      ],
    },
    {
      id: 'type-wellness',
      name: 'Annual Wellness Exam',
      durationMinutes: 45,
      description:
        'Preventive physical exam, immunizations review, and health screening plan.',
      telehealthAvailable: false,
      preparationInstructions: [
        'Fast for 8 hours prior if morning lab work is scheduled.',
      ],
    },
  ],
};
