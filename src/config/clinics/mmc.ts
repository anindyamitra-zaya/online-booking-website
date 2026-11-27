import type { ClinicBundleConfig } from '../../types/clinic';

export const mmcConfig: ClinicBundleConfig = {
  clinic: {
    id: 'mmc',
    name: 'MMC Specialty Clinic',
    shortName: 'MMC',
    specialty: 'Comprehensive Medical & Preventive Care',
    phone: '(512) 555-0420',
    supportEmail: 'care@mmcspecialty.example',
    cancellationPolicyHours: 24,
    bannerImage: '/src/assets/images/clinic_atrium_interior.webp',
    themeColor: '#9CAD39',
    bookingNote:
      'A $50 no-show fee applies if you miss a scheduled appointment without cancelling at least 24 hours in advance.',
    reschedulePolicy: {
      lockProvider: true,
      lockLocation: true,
    },
    accommodations: [
      'Wheelchair & mobility assistance',
      'ASL sign language interpreter',
      'Large-print intake forms',
      'Sensory-friendly quiet waiting area',
    ],
    commonVisitReasons: {
      default: [
        'New symptom evaluation',
        'Preventive health consultation',
        'Follow-up & medication review',
        'Lab or imaging results review',
        'Chronic care management',
      ],
      byAppointmentType: {
        'type-mmc-new-consult': [
          'New patient comprehensive intake',
          'Specialist referral consultation',
          'Preventive health evaluation',
          'Medication & symptom review',
        ],
      },
    },
    cancellationReasons: [
      'Schedule conflict',
      'Symptoms improved / no longer needed',
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
        id: 'loc-mmc-main',
        name: 'MMC Medical Pavilion',
        address: '2400 Medical Pkwy, Suite 300',
        cityStateZip: 'Austin, TX 78705',
        phone: '(512) 555-0420',
        hours: 'Mon–Fri 8:00 AM – 5:30 PM',
        parkingNote:
          'Complimentary ground-level patient parking beside the main atrium',
        accessibilityFeatures: [
          'Step-free elevator & ramp access',
          'ADA compliant exam rooms',
          'Bilingual check-in assistance',
        ],
      },
    ],
  },
  providers: [
    {
      id: 'prov-mmc-patel',
      name: 'Dr. Maya Patel',
      credentials: 'MD, FACP',
      specialty: 'Internal & Preventive Medicine',
      bio: 'Board-certified internist focused on comprehensive diagnostics, chronic care coordination, and preventive health.',
      languages: ['English', 'Hindi', 'Spanish'],
      locationIds: ['loc-mmc-main'],
      telehealthEnabled: true,
      nextAvailableDate: '2026-11-19',
    },
  ],
  appointmentTypes: [
    {
      id: 'type-mmc-new-consult',
      name: 'New Patient Consultation',
      durationMinutes: 45,
      description:
        'Comprehensive initial evaluation, medical history review, and personalized care plan.',
      telehealthAvailable: true,
      applicablePatientKinds: ['new'],
      preparationInstructions: [
        'Bring a photo ID, insurance card, and list of current medications.',
        'Arrive 15 minutes early for new patient check-in.',
      ],
    },
    {
      id: 'type-mmc-followup',
      name: 'Follow-Up Visit',
      durationMinutes: 30,
      description:
        'Review treatment progress, lab findings, and ongoing care recommendations.',
      telehealthAvailable: true,
      applicablePatientKinds: ['established'],
      preparationInstructions: [
        'Bring any updated home readings or recent outside lab reports.',
      ],
    },
    {
      id: 'type-mmc-annual',
      name: 'Annual Preventive Evaluation',
      durationMinutes: 45,
      description:
        'Yearly preventive screening, immunization review, and long-term wellness check.',
      telehealthAvailable: false,
      applicablePatientKinds: ['established'],
      preparationInstructions: [
        'Fast for 8 hours prior if morning lab work is scheduled.',
      ],
    },
  ],
};
