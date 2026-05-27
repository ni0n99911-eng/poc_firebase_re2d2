// ──────────────────────────────────────────────
// Operations Einstein Data Models
// ──────────────────────────────────────────────

export interface SOP {
	id: string;
	title: string;
	category: string;
	steps: string[];
	frequency: 'daily' | 'weekly' | 'monthly' | 'as-needed';
	responsibleRole: string;
}

export interface ComplianceRule {
	id: string;
	jurisdiction: 'NYC' | 'NYS' | 'Federal';
	category: string;
	description: string;
	requirement: string;
	penalty?: string;
}

export interface HandbookSection {
	id: string;
	title: string;
	content?: string;
	subsections?: string[];
}

export interface OperationsConfig {
	businessType: string;
	businessName: string;
	city: string;
	state: string;
	universalSOPs: SOP[];
	verticalSOPs: SOP[];
	complianceRules: ComplianceRule[];
	handbookSections: HandbookSection[];
	visionStatement?: string;
	operatingHours?: string;
	staffingModel?: string;
	laborBudget?: number;
	sqft?: number;
	seatingCapacity?: number;
}

export interface VerticalSOPTemplate {
	name: string;
	sops: Omit<SOP, 'id'>[];
}

export const HANDBOOK_SECTION_TEMPLATES: HandbookSection[] = [
	{ id: 'welcome', title: 'Welcome & Mission' },
	{ id: 'employment', title: 'Employment Basics' },
	{ id: 'compensation', title: 'Compensation & Pay' },
	{ id: 'schedule', title: 'Work Schedule & PTO' },
	{ id: 'conduct', title: 'Workplace Conduct' },
	{ id: 'health-safety', title: 'Health & Safety' },
	{ id: 'benefits', title: 'Benefits' },
	{ id: 'separation', title: 'Separation & Offboarding' },
	{ id: 'city-addendum', title: 'NYC/NYS Addendum' }
];

export const UNIVERSAL_SOPs: Omit<SOP, 'id'>[] = [
	{
		title: 'Opening Procedures',
		category: 'Operations',
		steps: [
			'Disarm alarm system and check for any overnight issues',
			'Turn on all lights and equipment',
			'Check temperature controls and adjust as needed',
			'Inspect facility for cleanliness and damage',
			'Review daily schedule and priority tasks',
			'Conduct brief team huddle',
			'Open doors and mark as open to public'
		],
		frequency: 'daily',
		responsibleRole: 'Opening Manager'
	},
	{
		title: 'Closing Procedures',
		category: 'Operations',
		steps: [
			'Stop serving customers 15 minutes before closing',
			'Clean all customer-facing areas',
			'Secure all cash and reconcile register',
			'Complete end-of-day inventory counts',
			'Turn off all non-essential equipment',
			'Lock all doors and windows',
			'Arm alarm system',
			'Lock up and depart'
		],
		frequency: 'daily',
		responsibleRole: 'Closing Manager'
	},
	{
		title: 'Cash Handling & Register Reconciliation',
		category: 'Finance',
		steps: [
			'Count register at start and end of shift',
			'Reconcile cash against register tape',
			'Deposit excess cash in safe immediately',
			'Document all discrepancies',
			'Follow two-person rule for large cash transactions',
			'Use secure transport for deposits',
			'Maintain detailed cash log'
		],
		frequency: 'daily',
		responsibleRole: 'Shift Manager'
	},
	{
		title: 'Employee Onboarding',
		category: 'HR',
		steps: [
			'Complete I-9 and tax forms',
			'Provide employee handbook',
			'Conduct orientation on policies and procedures',
			'Review safety protocols and emergency procedures',
			'Complete required training certifications',
			'Assign role-specific training',
			'Schedule 30-day check-in',
			'Complete background check verification'
		],
		frequency: 'as-needed',
		responsibleRole: 'HR Manager'
	},
	{
		title: 'Customer Complaint Resolution',
		category: 'Customer Service',
		steps: [
			'Listen to customer complaint without interruption',
			'Express empathy and apologize for the issue',
			'Document the complaint details',
			'Offer immediate resolution options',
			'Implement chosen solution',
			'Follow up with customer after 24 hours',
			'Report to management for trending analysis',
			'Update procedures if pattern emerges'
		],
		frequency: 'as-needed',
		responsibleRole: 'Any Team Member / Manager'
	},
	{
		title: 'Emergency Response & Evacuation',
		category: 'Safety',
		steps: [
			'Identify emergency type (fire, medical, security)',
			'Activate emergency protocol specific to situation',
			'Call 911 for medical or life-threatening emergencies',
			'Evacuate building if necessary using posted exit routes',
			'Conduct headcount away from building',
			'Account for all employees and customers',
			'Communicate with emergency responders',
			'Document incident and notify management'
		],
		frequency: 'as-needed',
		responsibleRole: 'Any Team Member'
	},
	{
		title: 'Facility Cleaning & Sanitation',
		category: 'Sanitation',
		steps: [
			'Clean all customer-facing surfaces hourly',
			'Sanitize restrooms every 2 hours',
			'Empty trash and recycling as needed',
			'Deep clean kitchen areas daily',
			'Clean HVAC filters monthly',
			'Pressure wash exterior surfaces monthly',
			'Organize and remove clutter daily',
			'Document all cleaning activities'
		],
		frequency: 'daily',
		responsibleRole: 'Cleaning Staff / All Team Members'
	}
];

export const VERTICAL_SOP_TEMPLATES: Record<string, VerticalSOPTemplate> = {
	coffee: {
		name: 'Coffee Shop',
		sops: [
			{
				title: 'Espresso Machine Calibration & Pull Standards',
				category: 'Coffee Operations',
				steps: [
					'Purge group heads and run water through portafilter',
					'Pull test shot into measuring cup',
					'Measure shot weight and time (target: 18-20g in, 36-40g out, 25-30 seconds)',
					'Adjust grind based on results',
					'Pull 3 consecutive test shots to verify consistency',
					'Adjust temperature if extraction speed off',
					'Document baseline settings',
					'Run cleaning cycle after each pull'
				],
				frequency: 'daily',
				responsibleRole: 'Barista Trainer / Lead Barista'
			},
			{
				title: 'Drink Standards & Quality Control',
				category: 'Coffee Operations',
				steps: [
					'Use standardized recipe for all drinks',
					'Measure milk volume for each drink type',
					'Target consistent crema and extraction',
					'Maintain milk temperature (150-155°F)',
					'Perform latte art on all milk drinks',
					'Check drink taste and visual appearance',
					'Remake any drinks that fail QC',
					'Train team on daily standards'
				],
				frequency: 'daily',
				responsibleRole: 'Barista'
			},
			{
				title: 'Food Safety & Storage',
				category: 'Food Safety',
				steps: [
					'Inspect all deliveries for quality and temperature',
					'Label all items with date received',
					'Store food at proper temperatures (cold <41°F, hot >135°F)',
					'Use FIFO rotation for all items',
					'Clean and sanitize food prep areas',
					'Wash hands before and after food handling',
					'Separate raw and prepared foods',
					'Check expiration dates and discard expired items'
				],
				frequency: 'daily',
				responsibleRole: 'All Staff / Food Safety Manager'
			},
			{
				title: 'Equipment Maintenance & Cleaning',
				category: 'Maintenance',
				steps: [
					'Daily backflush of espresso group heads',
					'Daily deep clean of portafilter and baskets',
					'Weekly descaling of espresso machine',
					'Weekly cleaning of steam wand',
					'Bi-weekly cleaning of grinder burrs',
					'Monthly deep clean of water filtration system',
					'Check equipment for visible wear or damage',
					'Schedule professional maintenance quarterly'
				],
				frequency: 'daily',
				responsibleRole: 'Lead Barista / Equipment Manager'
			},
			{
				title: 'Coffee Bean Ordering & Inventory',
				category: 'Inventory',
				steps: [
					'Track coffee consumption daily',
					'Order new beans when stock reaches 10 days supply',
					'Receive and inspect all deliveries',
					'Store beans in cool, dry location in airtight containers',
					'Rotate stock using FIFO method',
					'Document roast dates and tasting notes',
					'Conduct monthly inventory count',
					'Adjust ordering based on seasonal demand'
				],
				frequency: 'daily',
				responsibleRole: 'Barista / Manager'
			},
			{
				title: 'Customer Beverage Upselling & Engagement',
				category: 'Customer Service',
				steps: [
					'Greet every customer with friendly demeanor',
					'Suggest seasonal drinks and food items',
					'Educate customers about coffee origins and flavors',
					'Offer personal drink customizations',
					'Build repeat customer relationships',
					'Collect feedback on new drinks',
					'Create loyalty program engagement',
					'Document popular items for ordering'
				],
				frequency: 'daily',
				responsibleRole: 'Barista / All Team Members'
			},
			{
				title: 'Point of Sale & Order Management',
				category: 'Operations',
				steps: [
					'Verify customer order before charging',
					'Accurately input order into POS system',
					'Call out order to barista with drink size and name',
					'Apply any promotions or discounts correctly',
					'Process payment securely',
					'Print receipt and provide to customer',
					'Monitor queue and keep orders moving',
					'End shift with cash reconciliation'
				],
				frequency: 'daily',
				responsibleRole: 'Cashier / All Team Members'
			}
		]
	},
	restaurant: {
		name: 'Restaurant',
		sops: [
			{
				title: 'Kitchen Line Protocol & Service',
				category: 'Kitchen Operations',
				steps: [
					'Verify all line equipment is operational and clean',
					'Check that all stations are stocked and organized',
					'Review incoming orders and communicate priorities',
					'Plate items according to plating standards',
					'Check every plate before it leaves kitchen',
					'Call out order ready time to server',
					'Maintain line organization throughout service',
					'Complete closing line procedures'
				],
				frequency: 'daily',
				responsibleRole: 'Executive Chef / Line Cook'
			},
			{
				title: 'Front of House Service Standards',
				category: 'Service',
				steps: [
					'Greet guests within 2 minutes of seating',
					'Provide water and present menu',
					'Explain specials and answer menu questions',
					'Place drink order and deliver within 3 minutes',
					'Take food order when ready',
					'Check in after first bite of food',
					'Clear plates promptly',
					'Present dessert menu and offer after-dinner drinks',
					'Present bill professionally',
					'Thank guest and invite return'
				],
				frequency: 'daily',
				responsibleRole: 'Server'
			},
			{
				title: 'Food Safety & HACCP Procedures',
				category: 'Food Safety',
				steps: [
					'Monitor food temperatures throughout service',
					'Maintain hot food at 135°F+, cold food at 41°F-',
					'Use separate cutting boards for raw and cooked items',
					'Wash hands before and after food handling',
					'Avoid cross-contamination between stations',
					'Date and label all prepared items',
					'Follow FIFO rotation for all ingredients',
					'Document temperature checks every 4 hours',
					'Dispose of food at end of service shift'
				],
				frequency: 'daily',
				responsibleRole: 'All Kitchen Staff / Health & Safety Manager'
			},
			{
				title: 'Allergen Management & Communication',
				category: 'Food Safety',
				steps: [
					'Maintain detailed allergen documentation for all menu items',
					'Train all staff on allergen locations',
					'Ask customers about allergies at start of service',
					'Highlight allergies on tickets to kitchen',
					'Use separate prep areas for allergen-containing items',
					'Document all allergen requests in POS',
					'Do not substitute ingredients without manager approval',
					'Educate kitchen staff on cross-contamination risks'
				],
				frequency: 'daily',
				responsibleRole: 'All Staff / Allergen Manager'
			},
			{
				title: 'Alcohol Service & Responsible Beverage Service',
				category: 'Compliance',
				steps: [
					'Check ID for all alcohol purchases',
					'Refuse service to intoxicated customers',
					'Limit alcohol service to licensed staff only',
					'Follow local happy hour and promotion regulations',
					'Document all RBS training certifications',
					'Maintain inventory controls on alcohol',
					'Monitor for signs of over-service',
					'Report incidents and violations'
				],
				frequency: 'daily',
				responsibleRole: 'Bartender / All Service Staff'
			},
			{
				title: 'Inventory Management & COGS Control',
				category: 'Finance',
				steps: [
					'Conduct daily par level checks on key items',
					'Order at target quantities to minimize waste',
					'Receive and verify all deliveries',
					'Rotate stock using FIFO',
					'Track food waste and identify patterns',
					'Conduct weekly inventory counts',
					'Calculate food cost percentage',
					'Adjust recipes if food cost exceeds target'
				],
				frequency: 'weekly',
				responsibleRole: 'Chef / Manager'
			},
			{
				title: 'Health Inspection Preparation & Compliance',
				category: 'Compliance',
				steps: [
					'Maintain up-to-date certifications for all staff',
					'Document all food safety training',
					'Keep facility in constant inspection-ready condition',
					'Maintain detailed cleaning logs',
					'Schedule routine deep cleans',
					'Fix violations immediately when discovered',
					'Keep inspection reports accessible',
					'Create action plan if violations occur'
				],
				frequency: 'weekly',
				responsibleRole: 'Manager / Health & Safety Officer'
			},
			{
				title: 'Table Management & Turnover',
				category: 'Operations',
				steps: [
					'Track table availability in real-time',
					'Prioritize walk-ins and reservations fairly',
					'Clear and reset tables quickly between guests',
					'Provide consistent service timing',
					'Manage wait time expectations',
					'Optimize seating for maximizing covers',
					'Track average table length of stay',
					'Adjust staffing based on turn predictions'
				],
				frequency: 'daily',
				responsibleRole: 'Host / Server'
			},
			{
				title: 'Delivery Order Processing & Quality',
				category: 'Operations',
				steps: [
					'Verify order accuracy before sealing',
					'Use proper packaging to maintain food quality',
					'Include all condiments and utensils',
					'Apply tamper-evident seals',
					'Deliver in timely manner (target: 30-45 min)',
					'Collect payment and provide receipt',
					'Check for delivery feedback daily',
					'Adjust packaging if complaints occur'
				],
				frequency: 'daily',
				responsibleRole: 'Kitchen & Delivery Staff'
			},
			{
				title: 'Daily Pre-Service & Opening Inspection',
				category: 'Operations',
				steps: [
					'Inspect all dining areas for cleanliness',
					'Verify all tables have correct place settings',
					'Check that POS system is working',
					'Verify reservation system is updated',
					'Check staff uniform compliance',
					'Review staff schedule and roles',
					'Communicate daily specials and changes',
					'Brief staff on busy shifts or large reservations'
				],
				frequency: 'daily',
				responsibleRole: 'Manager / Host'
			},
			{
				title: 'Kitchen Equipment Maintenance & Safety',
				category: 'Maintenance',
				steps: [
					'Daily inspection of all cooking equipment',
					'Check for temperature accuracy of ovens/coolers',
					'Verify ventilation hood is working',
					'Inspect for grease buildup and fire hazards',
					'Maintain equipment cleaning logs',
					'Schedule professional maintenance monthly',
					'Repair or remove unsafe equipment immediately',
					'Document all maintenance performed'
				],
				frequency: 'daily',
				responsibleRole: 'Executive Chef / Maintenance'
			},
			{
				title: 'Staff Training & Development',
				category: 'HR',
				steps: [
					'Conduct weekly training on new menu items',
					'Review customer feedback with team',
					'Train on proper service and food safety',
					'Role-play difficult customer scenarios',
					'Provide feedback on performance',
					'Update staff on menu changes and pricing',
					'Document all training completed',
					'Create development plans for advancement'
				],
				frequency: 'weekly',
				responsibleRole: 'Manager / Trainer'
			}
		]
	},
	gym: {
		name: 'Gym / Fitness',
		sops: [
			{
				title: 'Equipment Maintenance & Inspection',
				category: 'Maintenance',
				steps: [
					'Daily visual inspection of all equipment',
					'Check for loose bolts, fraying cables, or wear',
					'Test cardio equipment for proper operation',
					'Verify weight stacks move smoothly',
					'Check dumbbells for damage or misplacement',
					'Maintain equipment maintenance log',
					'Schedule professional servicing quarterly',
					'Remove broken equipment immediately'
				],
				frequency: 'daily',
				responsibleRole: 'Equipment Manager / Maintenance'
			},
			{
				title: 'Member Onboarding & Orientation',
				category: 'Member Services',
				steps: [
					'Welcome new member and complete intake form',
					'Discuss fitness goals and experience level',
					'Tour facility and explain all areas',
					'Explain rules, policies, and emergency procedures',
					'Offer personal training consultation',
					'Schedule initial assessment or orientation session',
					'Provide app access and class schedule',
					'Set follow-up appointment'
				],
				frequency: 'as-needed',
				responsibleRole: 'Front Desk / Membership Manager'
			},
			{
				title: 'Emergency Response & AED Procedures',
				category: 'Safety',
				steps: [
					'Train all staff on CPR and first aid',
					'Maintain AED in accessible location',
					'Check AED monthly for proper function',
					'Ensure staff certifications are current',
					'Post emergency procedures visibly',
					'Conduct quarterly emergency drills',
					'Document any incidents with full details',
					'Follow up with member and family after incident'
				],
				frequency: 'monthly',
				responsibleRole: 'Safety Manager / All Staff'
			},
			{
				title: 'Personal Training Sessions & Documentation',
				category: 'Member Services',
				steps: [
					'Conduct fitness assessment before starting',
					'Create personalized workout plan',
					'Demonstrate proper form on all exercises',
					'Progress exercises based on member improvement',
					'Document workout details and progress',
					'Take progress photos (with permission)',
					'Adjust plan based on goals and feedback',
					'Upsell additional services and packages'
				],
				frequency: 'as-needed',
				responsibleRole: 'Certified Personal Trainer'
			},
			{
				title: 'Group Class Management & Scheduling',
				category: 'Member Services',
				steps: [
					'Create balanced class schedule throughout week',
					'Hire certified instructors for all classes',
					'Maintain class roster and attendance',
					'Promote classes to increase attendance',
					'Ensure studio setup before each class',
					'Document class ratings and feedback',
					'Adjust schedule based on attendance patterns',
					'Manage class size to ensure member safety'
				],
				frequency: 'weekly',
				responsibleRole: 'Group Fitness Manager'
			},
			{
				title: 'Facility Sanitation & Cleaning Standards',
				category: 'Sanitation',
				steps: [
					'Provide sanitation wipes at all stations',
					'Require members to clean equipment after use',
					'Deep clean all equipment daily',
					'Sanitize locker rooms every 2 hours',
					'Clean and stock restrooms hourly',
					'Wash all towels and mats after each use',
					'Disinfect high-touch areas throughout day',
					'Maintain HVAC system and air quality'
				],
				frequency: 'daily',
				responsibleRole: 'Cleaning Staff / All Members'
			},
			{
				title: 'Member Check-In & Access Control',
				category: 'Operations',
				steps: [
					'Verify membership status at check-in',
					'Update last-visit information',
					'Monitor facility capacity',
					'Enforce access restrictions as needed',
					'Handle membership pauses or cancellations',
					'Process guest passes appropriately',
					'Maintain sign-in log for legal purposes',
					'Track membership utilization metrics'
				],
				frequency: 'daily',
				responsibleRole: 'Front Desk Staff'
			},
			{
				title: 'Locker Room & Facility Safety',
				category: 'Safety',
				steps: [
					'Conduct hourly security checks',
					'Monitor for suspicious activity',
					'Ensure adequate lighting throughout facility',
					'Keep emergency exits clear',
					'Enforce locker security policies',
					'Report maintenance issues immediately',
					'Implement buddy system for safety',
					'Document any incidents'
				],
				frequency: 'daily',
				responsibleRole: 'All Staff / Security'
			}
		]
	},
	laundromat: {
		name: 'Laundromat',
		sops: [
			{
				title: 'Washing Machine Operation & Cycle Management',
				category: 'Operations',
				steps: [
					'Verify all machines are operational before opening',
					'Check water temperature on hot water machines',
					'Test coin/card system on all units',
					'Monitor water pressure throughout day',
					'Clean coin boxes and card readers',
					'Report malfunctioning machines immediately',
					'Post machine status signs for out-of-order units',
					'Document machine usage and revenue'
				],
				frequency: 'daily',
				responsibleRole: 'Attendant / Manager'
			},
			{
				title: 'Dryer Equipment Maintenance & Ventilation',
				category: 'Maintenance',
				steps: [
					'Check dryer lint filters before opening',
					'Test heat on each dryer',
					'Verify ventilation system is working',
					'Clean outside dryer vents monthly',
					'Inspect ductwork for blockages',
					'Check for gas leaks on gas dryers',
					'Maintain temperature at 135-145°F',
					'Schedule professional maintenance quarterly'
				],
				frequency: 'daily',
				responsibleRole: 'Maintenance Technician'
			},
			{
				title: 'Wash-Fold-Iron Service Execution',
				category: 'Services',
				steps: [
					'Accept items and complete intake form',
					'Note any special instructions or damages',
					'Sort items by color and fabric type',
					'Wash using appropriate cycles and temperatures',
					'Dry items to proper moisture level',
					'Fold or hang items neatly',
					'Iron items that require it',
					'Package in clean bags',
					'Charge appropriate rate and collect payment'
				],
				frequency: 'as-needed',
				responsibleRole: 'Laundry Attendant'
			},
			{
				title: 'Cash & Card Handling Procedures',
				category: 'Finance',
				steps: [
					'Collect coins from all machines',
					'Count and reconcile revenue daily',
					'Verify card payment system reconciliation',
					'Secure cash in safe immediately',
					'Process deposit weekly or as needed',
					'Maintain detailed cash log',
					'Follow two-person rule for large amounts',
					'Document any discrepancies'
				],
				frequency: 'daily',
				responsibleRole: 'Manager / Attendant'
			},
			{
				title: 'Chemical Safety & Inventory',
				category: 'Safety',
				steps: [
					'Store all chemicals in secure area',
					'Follow proper handling and PPE requirements',
					'Keep MSDS sheets readily available',
					'Use appropriate ventilation when handling',
					'Label all containers clearly',
					'Dispose of waste properly',
					'Stock cleaning supplies appropriately',
					'Train staff on chemical safety'
				],
				frequency: 'weekly',
				responsibleRole: 'Manager / Safety Officer'
			}
		]
	},
	salon: {
		name: 'Salon / Spa',
		sops: [
			{
				title: 'Client Consultation & Service Planning',
				category: 'Service Delivery',
				steps: [
					'Greet client warmly and discuss goals',
					'Assess current hair/skin condition',
					'Show color/style options with reference photos',
					'Discuss realistic timelines and costs',
					'Address any concerns or limitations',
					'Document client preferences for future visits',
					'Get written consent for chemical services',
					'Explain aftercare instructions'
				],
				frequency: 'daily',
				responsibleRole: 'Stylist / Technician'
			},
			{
				title: 'Service Execution & Quality Standards',
				category: 'Service Delivery',
				steps: [
					'Follow service protocol exactly as trained',
					'Use quality products and techniques consistently',
					'Maintain clean, organized workspace',
					'Perform color mixing and application by standard',
					'Complete services within budgeted time',
					'Check final result meets client expectations',
					'Document service details for next visit',
					'Recommend retail products for home care'
				],
				frequency: 'daily',
				responsibleRole: 'Stylist / Technician'
			},
			{
				title: 'Sanitation & Sterilization Procedures',
				category: 'Health & Safety',
				steps: [
					'Sterilize all tools in autoclave before use',
					'Use single-use items for each client',
					'Wash hands with proper hygiene',
					'Disinfect workstations between clients',
					'Clean all towels and capes with hot water',
					'Dispose of chemical waste properly',
					'Maintain clean supply areas',
					'Document all sterilization procedures'
				],
				frequency: 'daily',
				responsibleRole: 'All Team Members'
			},
			{
				title: 'Chemical Safety & Handling',
				category: 'Health & Safety',
				steps: [
					'Store all chemicals properly labeled',
					'Wear PPE when handling chemicals',
					'Use adequate ventilation in service areas',
					'Mix chemicals correctly per instructions',
					'Never mix different chemical types',
					'Provide MSDS sheets to employees',
					'Train staff on chemical safety',
					'Dispose of waste according to regulations'
				],
				frequency: 'weekly',
				responsibleRole: 'Manager / Safety Officer'
			},
			{
				title: 'Appointment Management & Scheduling',
				category: 'Operations',
				steps: [
					'Maintain accurate online booking system',
					'Send appointment reminders 24 hours prior',
					'Confirm specialized service times',
					'Block time for breaks and cleanup',
					'Manage waitlist effectively',
					'Adjust schedule based on service duration',
					'Track no-shows and reschedules',
					'Balance workload among team members'
				],
				frequency: 'daily',
				responsibleRole: 'Receptionist / Manager'
			},
			{
				title: 'Commission & Tips Processing',
				category: 'Finance',
				steps: [
					'Track daily service sales per stylist',
					'Calculate commissions based on agreed rates',
					'Process tips accurately',
					'Document all transactions',
					'Pay commissions by agreed schedule',
					'Reconcile with actual revenue',
					'Handle disputes professionally',
					'Provide detailed commission statements'
				],
				frequency: 'weekly',
				responsibleRole: 'Manager / Accounting'
			},
			{
				title: 'State Board Compliance & Licensing',
				category: 'Compliance',
				steps: [
					'Verify all licenses current and displayed',
					'Maintain license renewal schedule',
					'Document continuing education credits',
					'Follow state-specific regulations',
					'Maintain client record protocols',
					'Report incidents if required by state',
					'Stay current on regulation changes',
					'Train staff on compliance requirements'
				],
				frequency: 'monthly',
				responsibleRole: 'Manager / Compliance Officer'
			}
		]
	},
	retail: {
		name: 'Retail Store',
		sops: [
			{
				title: 'Inventory Management & Stock Levels',
				category: 'Inventory',
				steps: [
					'Conduct daily par level checks',
					'Order items when reaching reorder points',
					'Receive and verify shipments',
					'Add SKU and barcode to system',
					'Stock shelves using FIFO rotation',
					'Maintain accurate inventory counts',
					'Identify and remove expired items',
					'Analyze sales trends for ordering'
				],
				frequency: 'daily',
				responsibleRole: 'Store Manager / Inventory Specialist'
			},
			{
				title: 'Visual Merchandising & Store Layout',
				category: 'Operations',
				steps: [
					'Follow planogram for shelf displays',
					'Create eye-catching window displays',
					'Group related items logically',
					'Maintain clean, organized shelves',
					'Update signage for specials and pricing',
					'Rotate seasonal merchandise',
					'Monitor for out-of-stock situations',
					'Photograph displays for reference'
				],
				frequency: 'daily',
				responsibleRole: 'Visual Merchant / All Staff'
			},
			{
				title: 'Customer Service & Sales Transactions',
				category: 'Customer Service',
				steps: [
					'Greet customers within 30 seconds',
					'Offer assistance and product information',
					'Suggest complementary items',
					'Process transactions accurately and quickly',
					'Handle returns and exchanges per policy',
					'Maintain friendly, professional demeanor',
					'Collect customer feedback',
					'Encourage loyalty program enrollment'
				],
				frequency: 'daily',
				responsibleRole: 'Sales Associate / Manager'
			},
			{
				title: 'Loss Prevention & Security',
				category: 'Security',
				steps: [
					'Monitor for suspicious activity',
					'Verify large purchases with receipt',
					'Control access to back office areas',
					'Track high-theft items closely',
					'Implement tag systems on valuable items',
					'Review security footage regularly',
					'Document incidents and investigations',
					'Train staff on loss prevention'
				],
				frequency: 'daily',
				responsibleRole: 'Manager / Security'
			},
			{
				title: 'E-commerce & BOPIS Order Fulfillment',
				category: 'Operations',
				steps: [
					'Monitor online orders in real-time',
					'Pick items from store inventory',
					'Verify quantities and quality',
					'Pack orders securely',
					'Prepare for shipping or in-store pickup',
					'Track order status in system',
					'Communicate delays to customers',
					'Collect feedback on fulfillment'
				],
				frequency: 'daily',
				responsibleRole: 'E-commerce Team / Fulfillment'
			},
			{
				title: 'Point of Sale & Register Operations',
				category: 'Operations',
				steps: [
					'Count register at start and end of shift',
					'Process transactions accurately',
					'Verify payment methods and amounts',
					'Manage returns and exchanges',
					'Apply coupons and discounts correctly',
					'Reconcile daily sales',
					'Resolve payment issues',
					'Secure cash in safe'
				],
				frequency: 'daily',
				responsibleRole: 'Cashier / Manager'
			}
		]
	},
	'professional-services': {
		name: 'Professional Services',
		sops: [
			{
				title: 'Client Intake & Onboarding',
				category: 'Client Management',
				steps: [
					'Schedule initial consultation',
					'Collect intake information and forms',
					'Review scope of work with client',
					'Discuss fees and payment terms',
					'Explain confidentiality and privacy policies',
					'Set expectations for communication',
					'Create engagement letter',
					'Establish file organization system'
				],
				frequency: 'as-needed',
				responsibleRole: 'Business Development / Manager'
			},
			{
				title: 'Confidentiality & Data Protection',
				category: 'Compliance',
				steps: [
					'Secure all client files physically',
					'Use encryption for digital files',
					'Limit access to authorized personnel only',
					'Establish data security protocols',
					'Train staff on confidentiality requirements',
					'Create secure client portals if applicable',
					'Document compliance with regulations',
					'Implement regular security audits'
				],
				frequency: 'ongoing',
				responsibleRole: 'All Staff / Compliance Officer'
			},
			{
				title: 'Billable Hours Tracking & Time Management',
				category: 'Finance',
				steps: [
					'Record time spent on each client matter',
					'Use accurate time tracking system',
					'Bill at agreed-upon hourly rates',
					'Review time entries for accuracy',
					'Generate invoices with detail',
					'Provide time summary to client',
					'Adjust rates or terms if agreed',
					'Maintain time records for audit trail'
				],
				frequency: 'daily',
				responsibleRole: 'All Team Members'
			}
		]
	}
};

export const NYC_COMPLIANCE_RULES: ComplianceRule[] = [
	{
		id: 'nyc-hc-food',
		jurisdiction: 'NYC',
		category: 'Food Safety',
		description: 'NYC Health Code requires food service facilities to maintain A rating',
		requirement: 'Annual health inspections, maintain 85+ point rating',
		penalty: 'Fines up to $2,000 per violation'
	},
	{
		id: 'nyc-hc-labor',
		jurisdiction: 'NYC',
		category: 'Labor',
		description: 'Pay equity and scheduling requirements',
		requirement: 'Predictive scheduling 14 days advance, pay transparency',
		penalty: 'Fines $500-$2,500 per violation'
	},
	{
		id: 'nyc-bfl-wage',
		jurisdiction: 'NYC',
		category: 'Wages',
		description: 'NYC minimum wage requirements',
		requirement: 'Current minimum wage $15.00/hour (or higher per category)',
		penalty: 'Back pay + penalties up to 200% of wages owed'
	},
	{
		id: 'nyc-db-recycling',
		jurisdiction: 'NYC',
		category: 'Environmental',
		description: 'Mandatory waste reduction and recycling',
		requirement: 'Waste audit, recycling program, 50% waste reduction target',
		penalty: 'Fines $100-$500 per violation'
	},
	{
		id: 'nys-labor-law',
		jurisdiction: 'NYS',
		category: 'Labor',
		description: 'NYS Labor Law - I-9 and employee verification',
		requirement: 'Complete I-9 within 3 days of hire, verify employment eligibility',
		penalty: 'Fines $100-$1,000 per worker'
	},
	{
		id: 'nys-paid-leave',
		jurisdiction: 'NYS',
		category: 'PTO',
		description: 'Paid Sick Leave Law',
		requirement: '1 hour per 30 hours worked, minimum 40 hours/year',
		penalty: 'Up to $5,000 per violation'
	},
	{
		id: 'federal-eeo',
		jurisdiction: 'Federal',
		category: 'HR',
		description: 'Equal Employment Opportunity requirements',
		requirement: 'No discrimination, maintain EEO-1 records if 100+ employees',
		penalty: 'EEOC investigation, back pay, reinstatement'
	},
	{
		id: 'federal-osha',
		jurisdiction: 'Federal',
		category: 'Safety',
		description: 'OSHA safety requirements',
		requirement: 'Safe working conditions, injury reporting, worker training',
		penalty: 'Up to $145,000+ per serious violation'
	}
];

/**
 * Get complete operations config for a business
 */
export function getOperationsConfig(
	businessType: string,
	city: string,
	state: string,
	businessName?: string,
	visionStatement?: string,
	operatingHours?: string,
	staffingModel?: string,
	laborBudget?: number,
	sqft?: number,
	seatingCapacity?: number
): OperationsConfig {
	const template = VERTICAL_SOP_TEMPLATES[businessType.toLowerCase()] || VERTICAL_SOP_TEMPLATES.retail;

	// Create universal SOPs with IDs
	const universalSOPs: SOP[] = UNIVERSAL_SOPs.map((sop, idx) => ({
		id: `SOP-U0${idx + 1}`,
		...sop
	}));

	// Create vertical SOPs with IDs
	const verticalSOPs: SOP[] = template.sops.map((sop, idx) => ({
		id: `SOP-V${String(idx + 1).padStart(2, '0')}`,
		...sop
	}));

	// Get compliance rules based on location
	let complianceRules: ComplianceRule[] = [...NYC_COMPLIANCE_RULES];
	if (state === 'NY' && city !== 'New York') {
		// Add state-level rules, remove NYC-specific
		complianceRules = complianceRules.filter(r => r.jurisdiction !== 'NYC');
	}

	return {
		businessType,
		businessName: businessName || 'Your Business',
		city,
		state,
		universalSOPs,
		verticalSOPs,
		complianceRules,
		handbookSections: [...HANDBOOK_SECTION_TEMPLATES],
		visionStatement,
		operatingHours,
		staffingModel,
		laborBudget,
		sqft,
		seatingCapacity
	};
}
