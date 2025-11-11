import { column, Schema, Table } from '@powersync/react-native';

const hr_employee = new Table(
  {
    // id column (text) is automatically included
    resource_id: column.integer,
    company_id: column.integer,
    resource_calendar_id: column.integer,
    message_main_attachment_id: column.integer,
    color: column.integer,
    department_id: column.integer,
    job_id: column.integer,
    address_id: column.integer,
    work_contact_id: column.integer,
    work_location_id: column.integer,
    user_id: column.integer,
    parent_id: column.integer,
    coach_id: column.integer,
    private_state_id: column.integer,
    private_country_id: column.integer,
    country_id: column.integer,
    children: column.integer,
    country_of_birth: column.integer,
    bank_account_id: column.integer,
    distance_home_work: column.integer,
    km_home_work: column.integer,
    departure_reason_id: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    name: column.text,
    job_title: column.text,
    work_phone: column.text,
    mobile_phone: column.text,
    work_email: column.text,
    private_street: column.text,
    private_street2: column.text,
    private_city: column.text,
    private_zip: column.text,
    private_phone: column.text,
    private_email: column.text,
    lang: column.text,
    gender: column.text,
    marital: column.text,
    spouse_complete_name: column.text,
    place_of_birth: column.text,
    ssnid: column.text,
    sinid: column.text,
    identification_id: column.text,
    passport_id: column.text,
    permit_no: column.text,
    visa_no: column.text,
    certificate: column.text,
    study_field: column.text,
    study_school: column.text,
    emergency_contact: column.text,
    emergency_phone: column.text,
    distance_home_work_unit: column.text,
    employee_type: column.text,
    barcode: column.text,
    pin: column.text,
    private_car_plate: column.text,
    spouse_birthdate: column.text,
    birthday: column.text,
    visa_expire: column.text,
    work_permit_expiration_date: column.text,
    departure_date: column.text,
    employee_properties: column.text,
    additional_note: column.text,
    notes: column.text,
    departure_description: column.text,
    active: column.integer,
    is_flexible: column.integer,
    is_fully_flexible: column.integer,
    work_permit_scheduled_activity: column.integer,
    create_date: column.text,
    write_date: column.text,
    filter_job_position: column.integer,
    manager_id: column.integer,
    region_id: column.integer,
    employee_code: column.text,
    hourly_cost: column.text,
    timesheet_manager_id: column.integer,
    last_validated_timesheet_date: column.text,
    mobile_app_password: column.text,
    mobile_app_password_salt: column.text
  },
  { indexes: {} }
);

const odoo_gms_grower = new Table(
  {
    // id column (text) is automatically included
    id: column.text,
    timb_grower_id: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    grower_number: column.text,
    b010_first_name: column.text,
    b020_surname: column.text,
    b030_national_id: column.text,
    b040_phone_number: column.text,
    home_latitude: column.text,
    home_longitude: column.text,
    field_latitude: column.text,
    field_longitude: column.text,
    barn_latitude: column.text,
    barn_longitude: column.text,
    state: column.text,
    date_of_birth: column.text,
    timb_registration_date: column.text,
    new_update: column.integer,
    create_date: column.text,
    write_date: column.text,
    name: column.text,
    gender: column.text,
    middle_name: column.text,
    partner_id: column.integer,
    state_id: column.integer,
    country_id: column.integer,
    timb_sync_status: column.text,
    photo_national_file_name: column.text,
    street: column.text,
    zip: column.text,
    city: column.text,
    contact_address_complete: column.text,

  },
  { indexes: {} }
);

const odoo_gms_grower_application = new Table(
  {
    // id column (text) is automatically included
    id: column.text,
    mobile_app_id: column.text,
    grower_id: column.integer,
    production_cycle_id: column.integer,
    production_cycle_registration_id: column.integer,
    production_scheme_id: column.integer,
    region_id: column.integer,
    activity_id: column.integer,
    field_technician_id: column.integer,
    submitted_by: column.integer,
    approved_by: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    reference: column.text,
    state: column.text,
    data_source: column.text,
    application_type: column.text,
    grower_number: column.text,
    b010_first_name: column.text,
    b020_surname: column.text,
    middle_name: column.text,
    b030_national_id: column.text,
    b040_phone_number: column.text,
    home_latitude: column.text,
    home_longitude: column.text,
    field_latitude: column.text,
    field_longitude: column.text,
    barn_latitude: column.text,
    barn_longitude: column.text,
    gender: column.text,
    pcr_state: column.text,
    grower_name: column.text,
    grower_date_of_birth: column.text,
    rejection_reason: column.text,
    notes: column.text,
    submission_date: column.text,
    approval_date: column.text,
    create_date: column.text,
    write_date: column.text,
    b010_contract_scale: column.real,
    b020_contracted_yield: column.real,
    b030_contracted_volume: column.real,
    b040_contracted_price: column.real,
    b050_contracted_return: column.real,
    // grower_image: column.text,
    // grower_national_id_image: column.text,
    grower_image_url: column.text,
    grower_national_id_image_url: column.text
  },
  { indexes: {} }
);

const odoo_gms_flags = new Table(
  {
    // id column (text) is automatically included
    create_uid: column.integer,
    write_uid: column.integer,
    name: column.text,
    create_date: column.text,
    write_date: column.text
  },
  { indexes: {} }
);

const odoo_gms_production_scheme = new Table(
  {
    // id column (text) is automatically included
    create_uid: column.integer,
    write_uid: column.integer,
    name: column.text,
    reference: column.text,
    create_date: column.text,
    write_date: column.text,
    production_scheme_category_id: column.integer
  },
  { indexes: {} }
);

const odoo_gms_region = new Table(
  {
    // id column (text) is automatically included
    province_id: column.integer,
    supervisor_id: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    name: column.text,
    reference: column.text,
    create_date: column.text,
    write_date: column.text,
    parent_id: column.integer
  },
  { indexes: {} }
);

const odoo_gms_distribution_plan = new Table(
  {
    // id column (text) is automatically included
    production_cycle_id: column.integer,
    production_scheme_id: column.integer,
    activity_id: column.integer,
    price_list_id: column.integer,
    province_id: column.integer,
    region_id: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    create_date: column.text,
    write_date: column.text
  },
  { indexes: {} }
);

const odoo_gms_activity = new Table(
  {
    // id column (text) is automatically included
    unit_of_scale_id: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    name: column.text,
    reference: column.text,
    create_date: column.text,
    write_date: column.text
  },
  { indexes: {} }
);

const odoo_gms_production_cycle = new Table(
  {
    // id column (text) is automatically included
    activity_id: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    name: column.text,
    reference: column.text,
    create_date: column.text,
    write_date: column.text,
    sequence: column.integer,
    current_production_cycle: column.integer,
    current_marketing_cycle: column.integer
  },
  { indexes: {} }
);

const odoo_gms_production_cycle_registration = new Table(
  {
    // id column (text) is automatically included
    production_scheme_id: column.integer,
    production_cycle_id: column.integer,
    grower_id: column.integer,
    region_id: column.integer,
    activity_id: column.integer,
    field_technician_id: column.integer,
    supervisor_id: column.integer,
    overseer_id: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    timb_first_name: column.text,
    timb_surname: column.text,
    timb_name: column.text,
    grower_name: column.text,
    mobile: column.text,
    black_white_listed_state: column.text,
    contracted_state: column.text,
    state: column.text,
    timb_status: column.integer,
    correct_info: column.integer,
    wrong_grower: column.integer,
    whitelist_upload: column.integer,
    new_update: column.integer,
    create_date: column.text,
    write_date: column.text,
    b010_contract_scale: column.real,
    b020_contracted_yield: column.real,
    b030_contracted_volume: column.real,
    b040_contracted_price: column.real,
    b050_contracted_return: column.real,
    b060_estimated_scale: column.real,
    b070_estimated_yield: column.real,
    b080_estimated_volume: column.real,
    b090_estimated_price: column.real,
    b100_estimated_return: column.real,
    loan_amount: column.real,
    paid_amount: column.real,
    first_name: column.text,
    surname: column.text,
    distribution_plan: column.integer,
    balance: column.real,
    production_cycle_name: column.text
  },
  { 
    indexes: {
      // Index for JOIN operations and field technician queries
      field_technician_idx: ['field_technician_id'],
      grower_id_idx: ['grower_id']
    }
  }
);

const odoo_gms_input_confirmations = new Table(
  {
    // id column (text) is automatically included
    total_records_uploaded: column.integer,
    input_pack_id: column.integer,
    production_cycle_id: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    grv_number: column.text,
    date_input: column.text,
    create_date: column.text,
    write_date: column.text,
    region_id: column.integer,
    province_id: column.integer,
    technician_id: column.integer,
    issue_list_number: column.text,
    state: column.text,
    collection_voucher_id: column.integer,
    age_hours: column.integer,
    age_days: column.integer,
    age_display: column.text,
    completed_at: column.text,
    ordered_at: column.text,
    collected_at: column.text,
    total_hectares: column.real,
    total_growers: column.real
  },
  { 
    indexes: {
      // Index for JOIN operations
      input_pack_idx: ['input_pack_id']
    }
  }
);

const odoo_gms_input_confirmations_lines = new Table(
  {
    // id column (text) is automatically included
    production_cycle_registration_id: column.integer,
    input_confirmations_id: column.integer,
    provinces_id: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    excel_b010_first_name: column.text,
    excel_b020_surname: column.text,
    excel_region_id: column.text,
    excel_field_technician_id: column.text,
    create_date: column.text,
    write_date: column.text,
    excel_hectares: column.real,
    issue_state: column.text,
    distribution_plan_id: column.integer,
    input_confirmations_id_id: column.integer,
    latitude: column.text,
    longitude: column.text,
    collection_rq_vch_line_id: column.integer,
    input_pack_id: column.integer,
    product_group_id: column.integer,
    production_cycle_id: column.integer,
    state: column.text,
    issued_packs: column.real,
    voucher_id: column.integer,
    // mobile_grower_image: column.text,
    // mobile_grower_national_id_image: column.text,
    grower_image_url: column.text,
    grower_national_id_image_url: column.text,
    signature_url: column.text
  },
  { 
    indexes: {
      // Index on issue_state for faster filtering
      issue_state_idx: ['issue_state'],
      // Composite index for the most common query pattern
      pcr_issue_state_idx: ['production_cycle_registration_id', 'issue_state']
    } 
  }
);

const odoo_gms_input_pack = new Table(
  {
    // id column (text) is automatically included
    create_uid: column.integer,
    write_uid: column.integer,
    name: column.text,
    code: column.text,
    create_date: column.text,
    write_date: column.text,
    input_pack_type_id: column.integer,
    production_distribution_stage_id: column.integer
  },
  { indexes: {} }
);

const survey_question = new Table(
  {
    // id column (text) is automatically included
    survey_id: column.integer,
    sequence: column.integer,
    random_questions_count: column.integer,
    page_id: column.integer,
    scale_min: column.integer,
    scale_max: column.integer,
    time_limit: column.integer,
    validation_length_min: column.integer,
    validation_length_max: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    question_type: column.text,
    matrix_subtype: column.text,
    answer_date: column.text,
    validation_min_date: column.text,
    validation_max_date: column.text,
    title: column.text,
    description: column.text,
    question_placeholder: column.text,
    scale_min_label: column.text,
    scale_mid_label: column.text,
    scale_max_label: column.text,
    comments_message: column.text,
    validation_error_msg: column.text,
    constr_error_msg: column.text,
    is_page: column.integer,
    is_scored_question: column.integer,
    save_as_email: column.integer,
    save_as_nickname: column.integer,
    is_time_limited: column.integer,
    is_time_customized: column.integer,
    comments_allowed: column.integer,
    comment_count_as_answer: column.integer,
    validation_required: column.integer,
    validation_email: column.integer,
    constr_mandatory: column.integer,
    answer_datetime: column.text,
    validation_min_datetime: column.text,
    validation_max_datetime: column.text,
    create_date: column.text,
    write_date: column.text,
    answer_numerical_box: column.real,
    answer_score: column.real,
    validation_min_float_value: column.real,
    validation_max_float_value: column.real,
    measure: column.text,
    attachment_file_name: column.text,
    b090_Lower_Acceptable_Date: column.text,
    b0100_Benchmark_Date: column.text,
    b0110_Upper_Acceptable_Date: column.text,
    answer_boolean: column.integer,
    b0120_Lower_Acceptable_Date_Time: column.text,
    b0130_Benchmark_Date_Time: column.text,
    b0140_Upper_Acceptable_Date_Time: column.text,
    b060_Lower_Acceptable_Quantitative: column.real,
    b070_Benchmark_Quantitative: column.real,
    b080_Upper_Acceptable_Quantitative: column.real,
    b0120_Lower_Acceptable_Time: column.real,
    b0130_Benchmark_Time: column.real,
    b0140_Upper_Acceptable_Time: column.real
  },
  { indexes: {} }
);

const survey_question_answer = new Table(
  {
    // id column (text) is automatically included
    question_id: column.integer,
    matrix_question_id: column.integer,
    sequence: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    value_image_filename: column.text,
    value: column.text,
    is_correct: column.integer,
    create_date: column.text,
    write_date: column.text,
    answer_score: column.real
  },
  { indexes: {} }
);

const survey_survey = new Table(
  {
    // id column (text) is automatically included
    color: column.integer,
    user_id: column.integer,
    attempts_limit: column.integer,
    certification_mail_template_id: column.integer,
    certification_badge_id: column.integer,
    session_question_id: column.integer,
    session_speed_rating_time_limit: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    survey_type: column.text,
    questions_layout: column.text,
    questions_selection: column.text,
    progression_mode: column.text,
    access_mode: column.text,
    access_token: column.text,
    scoring_type: column.text,
    certification_report_layout: column.text,
    session_state: column.text,
    session_code: column.text,
    title: column.text,
    description: column.text,
    description_done: column.text,
    active: column.integer,
    users_login_required: column.integer,
    users_can_go_back: column.integer,
    is_attempts_limited: column.integer,
    is_time_limited: column.integer,
    certification: column.integer,
    certification_give_badge: column.integer,
    session_speed_rating: column.integer,
    session_start_time: column.text,
    session_question_start_time: column.text,
    create_date: column.text,
    write_date: column.text,
    scoring_success_min: column.real,
    time_limit: column.real,
    certification_validity_months: column.integer,
    a010_sequence: column.integer,
    a020_reference: column.text,
    a030_name: column.text,
    a040_description: column.text,
    default_instructions: column.text,
    a040_question: column.integer,
    b010_value_text: column.integer,
    b020_value_number: column.integer,
    b030_value_date: column.integer,
    b030_value_date_time: column.integer,
    value_boolean: column.integer,
    media_files: column.integer,
    c020_value_list: column.integer
  },
  { indexes: {} }
);

const survey_user_input = new Table(
  {
    // id column (text) is automatically included
    survey_id: column.integer,
    last_displayed_page_id: column.integer,
    partner_id: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    state: column.text,
    access_token: column.text,
    invite_token: column.text,
    email: column.text,
    nickname: column.text,
    scoring_total: column.text,
    test_entry: column.integer,
    scoring_success: column.integer,
    survey_first_submitted: column.integer,
    is_session_answer: column.integer,
    start_datetime: column.text,
    end_datetime: column.text,
    deadline: column.text,
    create_date: column.text,
    write_date: column.text,
    scoring_percentage: column.real,
    employee_id: column.integer,
    a010_sequence: column.integer,
    survey_measure_option_id: column.integer,
    destination: column.integer,
    survey_register_id: column.integer,
    data_source: column.text,
    a020_reference: column.text,
    a030_name: column.text,
    a040_description: column.text,
    b010_usage_type: column.text,
    b020_target_reference: column.text,
    b030_target_name: column.text,
    b030_target_description: column.text,
    b040_captured_at_geo_tag: column.text,
    measure_option_id: column.text,
    production_run: column.text,
    status: column.text,
    heading: column.text,
    comments: column.text,
    instructions: column.text,
    captured_latitude: column.text,
    captured_longitude: column.text,
    measurements_populated: column.integer,
    a040_question: column.integer,
    b010_value_text: column.integer,
    b020_value_number: column.integer,
    b030_value_date: column.integer,
    b030_value_date_time: column.integer,
    value_boolean: column.integer,
    media_files: column.integer,
    c020_value_list: column.integer,
    b050_capture_date_time: column.text,
    production_cycle_registration_id: column.integer,
    production_cycle_id: column.integer,
    question_id: column.integer,
    display_name: column.text,
    mobile_app_id: column.text
  },
  { indexes: {} }
);

const survey_user_input_line = new Table(
  {
    // id column (text) is automatically included
    user_input_id: column.integer, // Back to integer - will use random int locally, server ID after sync
    survey_id: column.integer,
    question_id: column.integer,
    question_sequence: column.integer,
    value_scale: column.integer,
    suggested_answer_id: column.integer,
    matrix_row_id: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    answer_type: column.text,
    value_char_box: column.text,
    value_date: column.text,
    value_text_box: column.text,
    skipped: column.integer,
    answer_is_correct: column.integer,
    value_datetime: column.text,
    create_date: column.text,
    write_date: column.text,
    value_numerical_box: column.real,
    answer_score: column.real,
    employee_id: column.integer,
    production_registration_cycle_id: column.integer,
    b050_capture_date_time: column.text,
    mobile_app_id: column.text
  },
  { indexes: {} }
);

const odoo_gms_collection_voucher = new Table(
  {
    // id column (text) is automatically included
    region_id: column.integer,
    input_pack_id: column.integer,
    truck_id: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    driver_name: column.text,
    driver_mobile: column.text,
    driver_national_id: column.text,
    state: column.text,
    name: column.text,
    collection_date: column.text,
    create_date: column.text,
    write_date: column.text,
    voucher_request_id: column.integer
  },
  { indexes: {} }
);

const odoo_gms_truck_reg = new Table(
  {
    // id column (text) is automatically included
    create_uid: column.integer,
    write_uid: column.integer,
    name: column.text,
    reg_number: column.text,
    reg_number_trailer: column.text,
    phone_number: column.text,
    create_date: column.text,
    write_date: column.text
  },
  { indexes: {} }
);

const odoo_gms_product_group = new Table(
  {
    // id column (text) is automatically included
    collection_point_id: column.integer,
    region_id: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    name: column.text,
    create_date: column.text,
    write_date: column.text,
    units: column.real,
    b020_multiplier: column.text,
    round_up: column.integer
  },
  { indexes: {} }
);

const odoo_gms_collection_point = new Table(
  {
    // id column (text) is automatically included
    region_id: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    name: column.text,
    address: column.text,
    contact_number: column.text,
    create_date: column.text,
    write_date: column.text
  },
  { indexes: {} }
);

const survey_register = new Table(
  {
    // id column (text) is automatically included
    survey_instance_id: column.integer,
    survey_id: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    name: column.text,
    b010_target_reference: column.text,
    b020_target_name: column.text,
    c010_status: column.text,
    b030_scheduled_date: column.text,
    create_date: column.text,
    write_date: column.text,
    production_cycle_registration_id: column.integer,
    production_cycle_id: column.integer,
    employee_id: column.integer,
    province_id: column.integer,
    b040_capture_date: column.text,
    field_tech: column.integer,
    region_id: column.integer,
    grower_id: column.integer,
    grower_name: column.text,
    grower_number: column.text
  },
  { indexes: {} }
);

const odoo_gms_hr_management = new Table(
  {
    // id column (text) is automatically included
    manager: column.integer,
    employee: column.integer,
    production_cycle_id: column.integer,
    region_id: column.integer,
    target_grower_count: column.integer,
    target_grower_hectares: column.integer,
    supervisor: column.integer,
    regional_supervisor: column.integer,
    regional_manager: column.integer,
    chairman_registration_id: column.integer,
    actual_grower_count: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    create_date: column.text,
    write_date: column.text,
    actual_grower_hectares: column.real
  },
  { indexes: {} }
);


const res_company = new Table(
  {
    // id column (text) is automatically included
    name: column.text,
    partner_id: column.integer,
    currency_id: column.integer,
    sequence: column.integer,
    create_date: column.text,
    parent_path: column.text,
    parent_id: column.integer,
    paperformat_id: column.integer,
    external_report_layout_id: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    email: column.text,
    phone: column.text,
    mobile: column.text,
    font: column.text,
    primary_color: column.text,
    secondary_color: column.text,
    layout_background: column.text,
    company_details: column.text,
    active: column.integer,
    uses_default_logo: column.integer,
    logo_web: column.text,
    partner_gid: column.integer,
    qr_code: column.integer,
    signing_user: column.integer,
    website_id: column.integer
  },
  { indexes: {} }
);


const ir_config_parameter = new Table(
  {
    // id column (text) is automatically included
    create_uid: column.integer,
    write_uid: column.integer,
    key: column.text,
    value: column.text,
    create_date: column.text,
    write_date: column.text
  },
  { indexes: {} }
);

const media_files = new Table({
  id: column.text, // Changed from integer to text to support UUID strings
  mobile_grower_image: column.text,
  mobile_grower_national_id_image: column.text,
  mobile_signature_image: column.text,
  model: column.text,
  create_date: column.text,
  write_date: column.text
}, {
  localOnly: true
});

const grower_application_drafts = new Table({
  id: column.text, // UUID for the draft
  draft_name: column.text, // User-friendly name for the draft
  form_data: column.text, // JSON string containing all form fields
  created_at: column.text,
  modified_at: column.text,
  submitted_by: column.text, // Employee ID who created the draft
}, {
  localOnly: true // This is local-only data, not synced to server
});








// --- start of receiving tables ---

const receiving_transporter_delivery_note = new Table(
  {
    // Odoo model: receiving.transporter_delivery_note
    // Fields from both receiving_curverid and receiving_boka
    document_number: column.text,
    name: column.text, // Driver Name
    id_number: column.text,
    vehicle_registration: column.text,
    cellphone: column.text,
    creditor_number: column.text,
    season_id: column.integer,
    transporter_name: column.text,
    number_of_growers: column.integer,
    number_of_bales: column.integer,
    validated_bales: column.integer,
    pending_validation_count: column.integer,
    state: column.text,
    transporter_cellphone: column.text,
    is_atlas_transporter: column.integer, // Boolean
    bank: column.text,
    branch: column.text,
    account_number: column.text,
    transporter_timb_stop_order: column.text,
    create_uid: column.integer,
    write_uid: column.integer,
    create_date: column.text,
    write_date: column.text,
    creditor: column.text,
    physical_dnote_number: column.text,
  },
  { indexes: {} }
);

const receiving_grower_delivery_note = new Table({
  document_number: column.text,
  grower_number: column.text,
  location_id: column.integer,
  selling_point_id: column.integer,
  transporter_delivery_note_id: column.integer,
  number_of_bales: column.integer,
  total_mass: column.integer,
  state: column.text,
  number_of_bales_delivered: column.integer,
  preferred_sale_date: column.text, // Date
  grower_id: column.integer,
  percentage_completion: column.real,
  laying_date: column.text, // Date
  temp_laying_date: column.text, // Date
  sale: column.text,
  laying_status: column.text,
  booked_at: column.text, // Datetime
  has_been_booked: column.integer, // Boolean
  highest_lot: column.integer,
  lowest_lot: column.integer,
  bales_to_lay: column.text,
  selling_date: column.text, // Date
  bales_laid_on_floor: column.text,
  floor_sale: column.integer,
  grower_name: column.text,
  season_sequence: column.integer,
  is_reoffer: column.integer, // Boolean
  floor_row: column.integer,
  has_salesmaster: column.text,
  sales_sheet: column.text,
  season_id: column.integer,
  active: column.integer, // Boolean
  user_closed_by: column.integer,
  user_closed_time: column.text, // Datetime
  ticket_printing_ready: column.integer, // Boolean
  create_uid: column.integer,
  write_uid: column.integer,
  create_date: column.text,
  write_date: column.text,
});

// Local-only drafts for Scale Bale session pause/resume
const sequencing_session_drafts = new Table({
  id: column.text, // UUID
  draft_name: column.text,
  form_data: column.text, // JSON string payload
  created_at: column.text,
  modified_at: column.text,
  submitted_by: column.text,
}, {
  localOnly: true
});

const receiving_bale = new Table(
  {
    // id column (text) is automatically included
    grower_delivery_note_id: column.text,
    document_number: column.text,
    sale_split_id: column.integer,
    group_number: column.integer,
    mass: column.real,
    mass_overweight: column.text,
    location_id: column.integer,
    delivery_sequence: column.integer,
    price: column.integer,
    batch_price: column.integer,
    timb_grade: column.integer,
    buyer: column.integer,
    buyer_grade: column.integer,
    current_seq: column.integer,
    dispatched_by_id: column.integer,
    packing_warehouse_id: column.integer,
    season_id: column.integer,
    buyer_number: column.integer,
    ntrm_number: column.integer,
    user_dnote: column.integer,
    user_floor_summary: column.integer,
    user_dispatch: column.integer,
    user_hold: column.integer,
    user_hold_out: column.integer,
    floor_summary_row: column.integer,
    create_uid: column.integer,
    write_uid: column.integer,
    barcode: column.text,
    scale_barcode: column.text,
    lot_number: column.text,
    state: column.text,
    grower_number: column.text,
    sale: column.text,
    scale_id: column.text,
    move_to: column.text,
    sale_date: column.text,
    selling_date: column.text,
    floor_summary_scan: column.text,
    floor_summary_seq: column.text,
    zw_price: column.text,
    is_printed: column.integer,
    active: column.integer,
    warehouse_upload: column.integer,
    dispatch_date_time: column.text,
    user_dnote_time: column.text,
    user_floor_summary_time: column.text,
    user_hold_time: column.text,
    user_hold_out_time: column.text,
    create_date: column.text,
    write_date: column.text,
    salesmaster_id: column.integer,
    batchmaster_id: column.integer,
    salecode_id: column.integer,
    auto_buyer: column.integer,
    floor_clearing: column.text,
    luggagetag: column.text,
    curverid_buyer_number: column.text,
    curverid_ntrm_number: column.text,
    curverid_buyer_grade: column.text,
    curverid_timb_grade: column.text,
    buyer_name: column.integer,
    checker_name: column.integer,
    classifier: column.integer,
    source_mass: column.real,
    lot_number_integer: column.integer,
    selling_point_code: column.text,
    hessian: column.integer  // Foreign key to receiving_hessian
  },
  { indexes: {} }
);



const receiving_curverid_row_management = new Table({
  // Odoo model: receiving_curverid.row_management
  row_number: column.integer,
  date: column.text, // Date
  lay_number: column.integer,
  current_count: column.integer,
  max_count: column.integer,
  is_active_lay: column.integer, // Boolean
  last_updated: column.text, // Datetime
  active: column.integer, // Boolean
  create_uid: column.integer,
  write_uid: column.integer,
  create_date: column.text,
  write_date: column.text,
});

// Local-only mirror for receiving_curverid.bale_sequencing_model to track scans offline
const receiving_curverid_bale_sequencing_model = new Table({
  id: column.text,
  document_number: column.text,
  grower_delivery_note_id: column.text,
  scale_barcode: column.text,
  barcode: column.text,
  row: column.integer,
  lay: column.text,
  selling_point_id: column.integer,
  floor_sale_id: column.integer,
  scan_date: column.text,
  scan_datetime: column.text,
  create_date: column.text,
  write_date: column.text
}, { localOnly: true });

const receiving_boka_transporter_delivery_note_line = new Table({
  // Odoo model: receiving_boka.transporter_delivery_note_line
  transporter_delivery_note_id: column.integer,
  grower_number: column.text,
  location_id: column.integer,
  grower_name: column.text,
  voucher: column.text,
  number_of_bales: column.integer,
  actual_bales_found: column.integer,
  physical_validation_status: column.text,
  validation_notes: column.text,
  preferred_sale_date: column.text, // Date
  state: column.text,
  active: column.integer, // Boolean
  grower_delivery_note_id: column.integer,
  create_uid: column.integer,
  write_uid: column.integer,
  create_date: column.text,
  write_date: column.text,
});

const floor_maintenance_selling_point = new Table({
  // Odoo model: floor_maintenance.selling_point
  name: column.text,
  active: column.integer, // Boolean
  create_date: column.text,
  write_date: column.text,
});

const floor_maintenance_floor_sale = new Table({
  // Odoo model: floor_maintenance.floor_sale
  name: column.text,
  sale_point_id: column.integer, // This links it to the selling_point
  sale_date: column.text, // Date
  active: column.integer, // Boolean
  create_date: column.text,
  write_date: column.text,
});

const floor_maintenance_timb_grade = new Table(
  {
    // Odoo model: floor_maintenance.timb_grade
    name: column.text,
    create_date: column.text,
    write_date: column.text,
  },
  { indexes: {} }
);

const buyers_buyer = new Table({
  // Odoo model: buyers.buyer
  name: column.text,
  buyer_code: column.text,
  create_date: column.text,
  write_date: column.text,
});

const buyers_grade = new Table({
  // Odoo model: buyers.grade
  grade: column.text,
  buyer: column.integer, // Foreign key to buyers.buyer
  create_date: column.text,
  write_date: column.text,
});

const data_processing_salecode = new Table({
  // Odoo model: data_processing.salecode
  name: column.text,
  create_date: column.text,
  write_date: column.text,
});

const receiving_hessian = new Table({
  // Odoo model: receiving.hessian
  name: column.text,
  hessian_id: column.text,
  active: column.integer, // Boolean
  create_date: column.text,
  write_date: column.text,
});

const floor_maintenance_bale_location = new Table({
  // Odoo model: floor_maintenance.bale_location
  name: column.text,
  section: column.text,
  active: column.integer, // Boolean
  create_date: column.text,
  write_date: column.text,
});

// Ticket printing batches created when a GD Note completes
const receiving_ticket_printing_batch = new Table({
  // Odoo model: receiving.ticket_printing_batch
  grower_delivery_note_id: column.integer,
  state: column.text,
  create_uid: column.integer,
  write_uid: column.integer,
  create_date: column.text,
  write_date: column.text,
});


export const AppSchema = new Schema({
  hr_employee,
  odoo_gms_grower,
  odoo_gms_flags,
  odoo_gms_production_scheme,
  odoo_gms_region,
  odoo_gms_distribution_plan,
  odoo_gms_activity,
  odoo_gms_production_cycle,
  odoo_gms_production_cycle_registration,
  odoo_gms_grower_application,
  odoo_gms_input_confirmations,
  odoo_gms_input_confirmations_lines,
  odoo_gms_input_pack,
  survey_question,
  survey_question_answer,
  survey_survey,
  survey_user_input,
  survey_user_input_line,
  odoo_gms_collection_voucher,
  odoo_gms_truck_reg,
  odoo_gms_product_group,
  odoo_gms_collection_point,
  survey_register,
  media_files,
  grower_application_drafts,
  odoo_gms_hr_management,
  res_company,
  ir_config_parameter,



  
  // --- start of receiving tables ---
  receiving_transporter_delivery_note,
  receiving_grower_delivery_note,
  receiving_bale,
  receiving_curverid_row_management,
  receiving_curverid_bale_sequencing_model,
  receiving_boka_transporter_delivery_note_line,
  floor_maintenance_selling_point,
  floor_maintenance_floor_sale,
  floor_maintenance_timb_grade,
  buyers_buyer,
  buyers_grade,
  data_processing_salecode,
  receiving_hessian,
  floor_maintenance_bale_location,
  receiving_ticket_printing_batch,
  sequencing_session_drafts
});






// For types
export type Database = (typeof AppSchema)['types'];
export type EmployeeRecord = Database['hr_employee'];
export type GrowerRecord = Database['odoo_gms_grower'];
export type FlagsRecord = Database['odoo_gms_flags'];
export type ProductionSchemeRecord = Database['odoo_gms_production_scheme'];
export type RegionRecord = Database['odoo_gms_region'];
export type DistributionPlanRecord = Database['odoo_gms_distribution_plan'];
export type ActivityRecord = Database['odoo_gms_activity'];
export type ProductionCycleRecord = Database['odoo_gms_production_cycle'];
export type ProductionCycleRegistrationRecord = Database['odoo_gms_production_cycle_registration'];
export type GrowerApplicationRecord = Database['odoo_gms_grower_application'];
export type InputConfirmationsRecord = Database['odoo_gms_input_confirmations'];
export type InputConfirmationsLinesRecord = Database['odoo_gms_input_confirmations_lines'];
export type InputPackRecord = Database['odoo_gms_input_pack'];
export type SurveyQuestionRecord = Database['survey_question'];
export type SurveyQuestionAnswerRecord = Database['survey_question_answer'];
export type SurveySurveyRecord = Database['survey_survey'];
export type SurveyUserInputRecord = Database['survey_user_input'];
export type SurveyUserInputLineRecord = Database['survey_user_input_line'];
export type CollectionVoucherRecord = Database['odoo_gms_collection_voucher'];
export type TruckRegRecord = Database['odoo_gms_truck_reg'];
export type ProductGroupRecord = Database['odoo_gms_product_group'];
export type CollectionPointRecord = Database['odoo_gms_collection_point'];
export type SurveyRegisterRecord = Database['survey_register'];
export type MediaFilesRecord = Database['media_files'];
export type GrowerApplicationDraftRecord = Database['grower_application_drafts'];
export type OdooGmsHrManagementRecord = Database['odoo_gms_hr_management'];
export type ResCompanyRecord = Database['res_company'];
export type IrConfigParameterRecord = Database['ir_config_parameter'];



// --- receiving tables ---
export type TransporterDeliveryNoteRecord = Database['receiving_transporter_delivery_note'];
export type GrowerDeliveryNoteRecord = Database['receiving_grower_delivery_note'];
export type BaleRecord = Database['receiving_bale'];
export type RowManagementRecord = Database['receiving_curverid_row_management'];
export type TransporterDeliveryNoteLineRecord = Database['receiving_boka_transporter_delivery_note_line'];
export type SellingPointRecord = Database['floor_maintenance_selling_point'];
export type FloorSaleRecord = Database['floor_maintenance_floor_sale'];
export type TimbGradeRecord = Database['floor_maintenance_timb_grade'];
export type BuyerRecord = Database['buyers_buyer'];
export type BuyerGradeRecord = Database['buyers_grade'];
export type SaleCodeRecord = Database['data_processing_salecode'];
export type HessianRecord = Database['receiving_hessian'];
export type BaleLocationRecord = Database['floor_maintenance_bale_location'];
export type TicketPrintingBatchRecord = Database['receiving_ticket_printing_batch'];
export type SequencingSessionDraftRecord = Database['sequencing_session_drafts'];
