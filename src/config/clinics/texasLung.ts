import type { ClinicBundleConfig } from '../../types/clinic';

export type { ClinicBundleConfig };

export const texasLungConfig: ClinicBundleConfig = {
  clinic: {
    id: 'texas-lung',
    name: 'Texas Lung & Specialty Care',
    shortName: 'Texas Lung Care',
    specialty: 'Pulmonology, Respiratory Diagnostics & Sleep Medicine',
    phone: '(512) 555-0190',
    supportEmail: 'appointments@texaslungcare.example',
    cancellationPolicyHours: 24,
    bannerImage: '/src/assets/images/clinic_atrium_interior_1795001144756.jpg',
    brandAccent: 'teal',
    reschedulePolicy: {
      lockProvider: false,
      lockLocation: false,
    },
    accommodations: [
      'Wheelchair & mobility assistance',
      'ASL sign language interpreter',
      'Large-print intake forms',
      'Hearing loop equipped check-in',
      'Sensory-friendly quiet waiting area',
    ],
    commonVisitReasons: {
      default: [
        'Asthma / inhaler review',
        'Persistent or chronic cough',
        'Shortness of breath',
        'Sleep apnea / CPAP follow-up',
        'Lab or imaging results review',
        'Medication refill',
      ],
      byAppointmentType: {
        'type-sleep': [
          'CPAP pressure or mask review',
          'Daytime fatigue or snoring',
          'Sleep study results follow-up',
          'Device sync or supply check',
          'Medication review',
        ],
        'type-pft': [
          'Baseline spirometry test',
          'Shortness of breath evaluation',
          'Asthma / inhaler response check',
          'COPD monitoring',
          'Pre-procedure lung clearance',
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
        dateOfBirth: '1984-05-14',
      },
      {
        label: 'New Patient: Jordan Taylor',
        fullName: 'Jordan Taylor',
        dateOfBirth: '1990-03-12',
      },
    ],
    locations: [
      {
        id: 'loc-north-austin',
        name: 'North Austin Medical Plaza',
        address: '4200 N Lamar Blvd, Suite 210',
        cityStateZip: 'Austin, TX 78756',
        phone: '(512) 555-0190',
        hours: 'Mon–Fri 8:00 AM – 5:30 PM · Sat 9:00 AM – 12:00 PM',
        parkingNote:
          'Complimentary ground-level accessible parking near East Entrance',
        accessibilityFeatures: [
          'Step-free elevator & ramp access',
          'ADA compliant diagnostic suites',
          'Hearing loop at reception desk',
        ],
      },
      {
        id: 'loc-round-rock',
        name: 'Round Rock Specialty Pavilion',
        address: '1750 E Palm Valley Blvd, Suite 104',
        cityStateZip: 'Round Rock, TX 78664',
        phone: '(512) 555-0194',
        hours: 'Mon–Fri 8:30 AM – 5:00 PM',
        parkingNote:
          'Dedicated patient drop-off lane directly outside Suite 104',
        accessibilityFeatures: [
          'Single-story step-free clinic floor',
          'Bariatric & accessible exam seating',
          'Bilingual staff available daily',
        ],
      },
    ],
  },
  providers: [
    {
      id: 'prov-reed',
      name: 'Dr. Evelyn Reed',
      credentials: 'MD, FCCP',
      specialty: 'General Pulmonology & Asthma Care',
      bio: 'Board-certified pulmonologist focusing on severe asthma, chronic cough, and long-term respiratory wellness plans.',
      languages: ['English', 'Spanish'],
      locationIds: ['loc-north-austin', 'loc-round-rock'],
      telehealthEnabled: true,
      nextAvailableDate: '2026-11-19',
    },
    {
      id: 'prov-tanaka',
      name: 'Dr. Kenji Tanaka',
      credentials: 'MD, PhD',
      specialty: 'Pulmonary Function & Diagnostic Care',
      bio: 'Specialist in pulmonary diagnostics, COPD management, and cardiopulmonary exercise evaluation.',
      languages: ['English', 'Japanese'],
      locationIds: ['loc-north-austin'],
      telehealthEnabled: true,
      nextAvailableDate: '2026-11-20',
    },
    {
      id: 'prov-sharma',
      name: 'Dr. Anita Sharma',
      credentials: 'MD',
      specialty: 'Sleep Medicine & Respiratory Care',
      bio: 'Leads sleep-disordered breathing clinics, CPAP therapy optimization, and nocturnal oximetry reviews.',
      languages: ['English', 'Hindi'],
      locationIds: ['loc-north-austin', 'loc-round-rock'],
      telehealthEnabled: true,
      nextAvailableDate: '2026-11-19',
    },
    {
      id: 'prov-ramirez',
      name: 'Dr. Mateo Ramirez',
      credentials: 'MD, FACP',
      specialty: 'Interventional Pulmonology & Chest Screening',
      bio: 'Focuses on preventive lung screening, pleural conditions, and collaborative care with primary physicians.',
      languages: ['English', 'Spanish'],
      locationIds: ['loc-round-rock'],
      telehealthEnabled: false,
      nextAvailableDate: '2026-11-21',
    },
  ],
  appointmentTypes: [
    {
      id: 'type-followup',
      name: 'Pulmonary Follow-Up Visit',
      durationMinutes: 30,
      description:
        'Review ongoing treatment, inhaler effectiveness, symptom changes, and lab results with your specialist.',
      telehealthAvailable: true,
      preparationInstructions: [
        'Have your current medications or inhalers ready to review.',
        'Check in 10 minutes before your scheduled appointment time.',
      ],
    },
    {
      id: 'type-new-consult',
      name: 'New Patient Pulmonary Consultation',
      durationMinutes: 45,
      description:
        'Comprehensive evaluation for shortness of breath, chronic cough, asthma, or referral assessment.',
      telehealthAvailable: true,
      preparationInstructions: [
        'Bring recent chest X-ray or CT reports if performed outside our clinic.',
        'Arrive 15 minutes early to confirm insurance and health history.',
      ],
    },
    {
      id: 'type-pft',
      name: 'Spirometry & Lung Function Test',
      durationMinutes: 45,
      description:
        'In-clinic breathing measurement to assess lung volume, airflow, and bronchodilator response.',
      telehealthAvailable: false,
      preparationInstructions: [
        'Avoid short-acting rescue inhalers for 4 hours prior unless needed for breathing.',
        'Wear comfortable, non-restrictive clothing and avoid heavy meals 2 hours prior.',
      ],
    },
    {
      id: 'type-sleep',
      name: 'Sleep Apnea & CPAP Review',
      durationMinutes: 30,
      description:
        'Evaluate sleep study findings, daytime fatigue, or adjust CPAP/BiPAP pressure settings.',
      telehealthAvailable: true,
      preparationInstructions: [
        'Bring your CPAP SD card or confirm your wireless device sync is active.',
        'Note any mask comfort or nighttime wake-up concerns.',
      ],
    },
    {
      id: 'type-screening',
      name: 'Annual Chest & Preventive Screening',
      durationMinutes: 30,
      description:
        'Scheduled preventive respiratory check and shared decision-making for low-dose screening.',
      telehealthAvailable: false,
      preparationInstructions: [
        'Bring a list of current prescriptions and prior imaging dates.',
      ],
    },
  ],
};
