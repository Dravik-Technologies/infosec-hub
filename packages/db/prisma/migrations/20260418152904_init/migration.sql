-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Viewer',
    "site_id" TEXT,
    "site_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'Active',
    "yubikey" TEXT,
    "workstation" TEXT,
    "last_login" TIMESTAMP(3),
    "training_compliant" BOOLEAN NOT NULL DEFAULT false,
    "training_due" TEXT,
    "dod_8140" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "controls" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "family" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Not Implemented',
    "baseline" TEXT,
    "last_review" TEXT,
    "findings" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "description" TEXT,
    "implementation_guidance" TEXT,
    "site_id" TEXT NOT NULL,
    "conmon_status" TEXT,
    "conmon_group" TEXT,
    "conmon_frequency" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "priority" TEXT,
    "assignee" TEXT,
    "due_date" TEXT,
    "control" TEXT,
    "linked_controls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activity_id" TEXT,
    "evidence" TEXT,
    "created" TEXT,
    "created_by" TEXT,
    "notes" TEXT,
    "source" TEXT,
    "source_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poams" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "control_id" TEXT,
    "weakness" TEXT,
    "severity" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "site_id" TEXT NOT NULL,
    "source_type" TEXT,
    "source_id" TEXT,
    "responsible_party" TEXT,
    "point_of_contact" TEXT,
    "resources" TEXT,
    "scheduled_completion" TEXT,
    "milestones" JSONB DEFAULT '[]',
    "identified_date" TEXT,
    "ato_id" TEXT,
    "poam_type" TEXT,
    "comments" TEXT,
    "completed_date" TEXT,
    "closed_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ato_packages" (
    "id" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "issued" TEXT,
    "expires" TEXT,
    "ao" TEXT,
    "controls" INTEGER NOT NULL DEFAULT 0,
    "open_findings" INTEGER NOT NULL DEFAULT 0,
    "site_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ato_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "con_mon" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "control_id" TEXT NOT NULL,
    "control_title" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "due_date" TEXT NOT NULL,
    "daag_jsig_frequency" TEXT,
    "baseline_applicability" TEXT,
    "conmon_group" TEXT,
    "notes" TEXT,
    "completed_date" TEXT,
    "linked_controls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "con_mon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workstations" (
    "id" TEXT NOT NULL,
    "asset_tag" TEXT,
    "hostname" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Workstation',
    "username" TEXT,
    "site_id" TEXT,
    "os" TEXT,
    "ip" TEXT,
    "location" TEXT,
    "classification" TEXT NOT NULL DEFAULT 'Unclassified',
    "status" TEXT NOT NULL DEFAULT 'Available',
    "system" TEXT,
    "key_expiry" TEXT,
    "last_seen" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workstations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yubi_keys" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Unassigned',
    "username" TEXT,
    "site_id" TEXT,
    "issued" TEXT,
    "last_auth" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yubi_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "vendor" TEXT,
    "seats" INTEGER NOT NULL DEFAULT 0,
    "used" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "site_id" TEXT,
    "expires" TEXT,
    "cost" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Agreement',
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "signed" TEXT,
    "expires" TEXT,
    "parties" TEXT,
    "assigned_to" TEXT,
    "site_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "detail" TEXT,
    "site_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "message" TEXT,
    "site_id" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trackers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "columns" JSONB DEFAULT '[]',
    "rows" JSONB DEFAULT '[]',
    "subtrackers" JSONB DEFAULT '[]',
    "site_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trackers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mash_sites" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "scif_zones" INTEGER,
    "next_inspection" TEXT,

    CONSTRAINT "mash_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mash_site_id" TEXT NOT NULL,
    "position" TEXT,
    "clearance_level" TEXT NOT NULL,
    "clearance_granted" TEXT,
    "reinvestigation_due" TEXT,
    "training_due_date" TEXT,
    "annual_briefing_due" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "id" TEXT NOT NULL,
    "mash_site_id" TEXT NOT NULL,
    "control_id" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "notes" TEXT,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "mash_site_id" TEXT NOT NULL,
    "vendor" TEXT,
    "scope" TEXT,
    "total_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount_spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expiration" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mash_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "mash_site_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" TEXT NOT NULL DEFAULT 'v1.0',
    "file_ref" TEXT,
    "submitted_by" TEXT,
    "reviewed_by" TEXT,
    "approved_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mash_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "contract_id" TEXT NOT NULL,
    "mash_site_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'Expense',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "con_mon_site_id_control_id_key" ON "con_mon"("site_id", "control_id");

-- CreateIndex
CREATE UNIQUE INDEX "yubi_keys_serial_key" ON "yubi_keys"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "mash_sites_site_id_key" ON "mash_sites"("site_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controls" ADD CONSTRAINT "controls_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poams" ADD CONSTRAINT "poams_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ato_packages" ADD CONSTRAINT "ato_packages_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "con_mon" ADD CONSTRAINT "con_mon_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workstations" ADD CONSTRAINT "workstations_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yubi_keys" ADD CONSTRAINT "yubi_keys_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trackers" ADD CONSTRAINT "trackers_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_mash_site_id_fkey" FOREIGN KEY ("mash_site_id") REFERENCES "mash_sites"("site_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_mash_site_id_fkey" FOREIGN KEY ("mash_site_id") REFERENCES "mash_sites"("site_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_mash_site_id_fkey" FOREIGN KEY ("mash_site_id") REFERENCES "mash_sites"("site_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mash_documents" ADD CONSTRAINT "mash_documents_mash_site_id_fkey" FOREIGN KEY ("mash_site_id") REFERENCES "mash_sites"("site_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
