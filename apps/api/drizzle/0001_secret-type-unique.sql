CREATE UNIQUE INDEX "encrypted_secrets_project_id_type_key" ON "encrypted_secrets" USING btree ("project_id", "type");
