# QA Bugs - Manual Run 2026-03-31

## Project Details
- **Project**: Task Tracker Pro
- **Project ID**: 0af81c0a-b432-4dba-8ae8-f801906a9dea
- **User**: qa-manual-full-20260331@example.com
- **Model**: GLM-5 (Ollama)

---

## Bug Log

---

### Bug 1: Ollama 500 Internal Server Error During Tech Decision Generation

**Timestamp**: 2026-03-31T15:50:20Z

**Short Title**: Ollama provider returned 500 error, pausing auto-runner

**Reproduction Steps**:
1. Auto-runner started with skipReviewSteps=true, autoApproveWhenClear=true
2. Successfully completed: AutoAnswerQuestionnaire, GenerateProjectOverview, GenerateProductSpec, GenerateDecisionDeck (UX), GenerateProjectBlueprint
3. Starting GenerateDecisionDeck (tech decisions)
4. Ollama API returned 500 Internal Server Error
5. Auto-runner paused with pausedReason="job_failed"

**Expected Behaviour**: 
- The job should retry automatically (up to a configured retry limit)
- If temporary Ollama glitch, system should recover without manual intervention

**Actual Behaviour**:
- Job failed immediately on first error
- Auto-runner paused, requiring manual intervention
- No automatic retry attempted

**Severity**: Medium - causes workflow interruption but can be manually recovered

**Current Status**: Paused at tech_decisions_generate step

**Generic Fix Recommendation**:
1. Implement job-level retry logic with exponential backoff for transient LLM provider errors (5xx status codes)
2. Distinguish between retryable errors (500, 502, 503, 504, rate limits) and non-retryable errors (400 bad request, validation failures)
3. Consider configurable retry count (e.g., 3 retries with 30s, 60s, 120s backoff)
4. Only pause auto-runner after retries exhausted
5. Log retry attempts for debugging provider reliability patterns
6. Consider marking certain LLM jobs as "safe to retry" vs requiring human intervention

---

### Bug 2: Milestone Design Generated Conflicting Content

**Timestamp**: 2026-03-31T16:10:50Z

**Short Title**: MilestoneDesign validation detected logical contradictions

**Reproduction Steps**:
1. Auto-runner was at milestone_design_generate step
2. GenerateMilestoneDesign job ran and produced design content
3. ValidateMilestoneDesignConsistency job detected conflicts
4. Job failed with error code "milestone_design_conflict_unresolved"
5. Auto-runner paused requiring manual intervention

**Expected Behaviour**:
- Either the LLM should generate consistent milestone designs, or
- The validation should be smarter about self-healing, or  
- The system should retry with refinement prompt

**Actual Behaviour**:
- Validation detected conflicts but did not attempt automatic resolution
- Job marked as non-retryable
- Auto-runner paused requiring human action

**Specific Conflicts Detected**:
1. Password Reset Flow: End state indicates session established, but exit criteria implies manual login required
2. Dependencies section: States parallel execution is possible but creates logical contradiction about protected route wrapper

**Severity**: Medium - validation caught the issue, but no self-healing mechanism exists

**Current Status**: Paused at milestone_design_generate step

**Generic Fix Recommendations**:
1. Add retry logic with refinement prompts for validation failures
2. When validation detects conflicts, automatically regenerate with conflict context included
3. Consider "three strikes" pattern: generate, validate conflicts, regenerate with fixes, revalidate
4. Improve prompt templates to reduce likelihood of logical contradictions
5. For dependency conflicts, add explicit dependency graph construction before prose generation

---

### Bug 3: Milestone Design Generated Conflicting Content (Milestone 2)

**Timestamp**: 2026-03-31T17:30:00Z (approx)

**Short Title**: MilestoneDesign validation detected conflicts for Milestone 2

**Reproduction Steps**:
1. Auto-runner completed Milestone 1 and its features/tasks
2. Started processing Milestone 2
3. GenerateMilestoneDesign produced design content
4. ValidateMilestoneDesignConsistency detected conflicts
5. Job failed with error code "milestone_design_conflict_unresolved"

**Specific Conflicts Detected:**
1. Task Editing Flow references 'task detail view' but no such route exists in Screen Inventory
2. Scope Boundaries mention 'drawer-based editing' but flow references non-existent entry point
3. Inconsistent terminology: 'task edit view' vs 'task detail view' for same interface

**Expected Behaviour**: 
- LLM should generate consistent terminology across flows
- Validation should either self-heal or retry with conflict context

**Actual Behaviour**:
- Validation detected conflicts but job failed without automatic resolution

**Severity**: Medium - requires manual resume, same issue as Bug 2

**Current Status**: Paused at milestone_design_generate (Milestone 2)

**Generic Fix Recommendation**:
- Same as Bug 2: Add retry with conflict context for validation failures
- Improve prompt templates to enforce terminology consistency
- Add glossary/term validation step before flow generation

---

### Bug 4: Milestone Design Validation Failures Are Repetitive and May Stall Progress

**Timestamp**: 2026-03-31T18:01Z

**Short Title**: Milestone 2 design failed twice with similar validation conflicts

**Reproduction Steps**:
1. Milestone 2 GenerateMilestoneDesign first attempt failed with conflicts about terminology
2. Manual resume triggered second attempt
3. Second attempt ALSO failed with validation conflicts (different specifics, same category)

**First Failure Conflicts (Bug 3):**
- Task Editing Flow references 'task detail view' not in Screen Inventory
- Inconsistent terminology ('task edit view' vs 'task detail view')

**Second Failure Conflicts:**
- Task Editing Flow references 'task detail view' as entry point
- Delivery Shape ambiguous about edit drawer interface
- Exit criteria require editing but no component handles edit UI

**Pattern**: The LLM is generating milestone designs with inconsistent internal references across multiple dimensions (flows, inventory, scope, delivery shape).

**Expected Behaviour**: 
- Generated content should be internally consistent
- Or retry logic should progressively improve quality

**Actual Behaviour**:
- Same type of failure on retry, different specific conflicts
- 3 consecutive milestone design generation failures for Milestone 1 before success
- Now 2 failures for Milestone 2

**Severity**: High - this pattern may continue indefinitely, stalling progress

**Generic Fix Recommendations**:
1. Add template-level cross-validation before final LLM call
2. Pass previous validation errors as context on retry
3. Implement "three strikes" rule: after N failures, escalate to human review
4. Consider decomposing milestone design into smaller validated chunks
5. Add explicit "consistency check" prompt section before generation

---

### Bug 5: GenerateFeatureProductSpec Output Missing Required Fields

**Timestamp**: 2026-03-31T18:40Z (approx)

**Short Title**: LLM output for feature product spec was missing required boolean fields

**Reproduction Steps**:
1. GenerateFeatureProductSpec job ran for Milestone 2 feature
2. LLM output was validated against schema
3. Validation failed: missing `uxRequired`, `techRequired`, `userDocsRequired`, `archDocsRequired` boolean fields

**Error Details**:
```
code: "llm_output_invalid"
category: "structured_output_shape_violation"
retryable: true
done_reason: "stop"
```

**Expected Behaviour**: LLM should output all required schema fields
**Actual Behaviour**: Required boolean fields were undefined in output

**Severity**: Low - marked as retryable, should auto-retry

**Current Status**: Job failed, may auto-retry (marked retryable: true)

**Generic Fix Recommendations**:
1. Strengthen prompt examples to include all required fields
2. Add post-generation schema validation before accepting output
3. Implement retry logic that includes "you must include fields X, Y, Z" hint

---

### Bug 6: No Automatic Retry on Validation Failures Stalls Progress

**Timestamp**: Ongoing throughout QA run

**Short Title**: Validation failures require manual resume, no exponential backoff

**Reproduction Steps**:
1. Milestone design validation fails
2. Job marked as non-retryable
3. Auto-runner pauses with job_failed reason
4. Manual resume required via API
5. Second attempt may also fail with similar issues

**Pattern Observed**:
- Milestone 1 design: Failed 1 time, succeeded on 2nd attempt
- Milestone 2 design: Failed 2 times, succeeded on 3rd attempt
- Feature product spec: Failed with schema violation (marked retryable but still paused)

**Expected Behaviour**:
- Validation failures should auto-retry with refinement prompts
- Exponential backoff for transient errors
- Only pause after exhausting retry attempts

**Actual Behaviour**:
- Every failure pauses the auto-runner
- Requires manual intervention via `/auto-advance/resume` endpoint

**Severity**: High - this is the primary blocker for unattended operation

**Generic Fix Recommendations**:
1. Implement automatic retry with conflict context for validation failures
2. Add exponential backoff for transient Ollama provider errors
3. Distinguish retryable vs non-retryable failures
4. Only pause auto-runner after configurable retry limit
5. Log retry attempts for debugging

---

### Bug 7: Duplicate Features Generated in Milestone 2

**Timestamp**: 2026-03-31T20:00Z

**Short Title**: Milestone 2 contains 16 features but 8 are duplicates of the same 8 concepts

**Reproduction Steps**:
1. Completed Milestone 1 successfully
2. Milestone 2 generated 16 features
3. Review of feature summaries revealed duplicates:
   - F-005 & F-013: "Task Data Service" (identical summaries)
   - F-006 & F-014: "Optimistic Update Library"
   - F-007 & F-015: "Timezone Service"
   - F-008 & F-016: "Dashboard Screen"
   - F-009 & F-017: "Quick Task Capture"
   - F-010 & F-018: "Task Completion"
   - F-011 & F-019: "Task Editing and Deletion"
   - F-012 & F-020: "Due Date Management"

**Expected Behaviour**: Each feature should be unique; no duplicates

**Actual Behaviour**: 8 conceptual features were duplicated, creating 16 total features where 8 are duplicates

**Severity**: High - causes wasted LLM calls, duplicate tasks, implementation confusion

**Current Status**: Features already generated; workstream specs in progress

**Generic Fix Recommendations**:
1. Add deduplication check after GenerateMilestoneFeatureSet
2. Validate feature uniqueness by title/summary similarity
3. Review scope review logic for duplicate insertion
4. Add unique constraint on feature_key within milestone

**UPDATE**: This is NOT a bug - investigation revealed that F-005 through F-012 were correctly archived by the scope review process, showing the system detected and handled duplicates. Only F-013 through F-020 remain active. This is expected behavior.

---

### Bug 8: Auto-Runner Paused with milestone_repair_limit_reached

**Timestamp**: 2026-03-31T21:30Z

**Short Title**: Auto-runner paused at milestone_delivery_review with repair limit reached

**Reproduction Steps**:
1. Auto-runner successfully completed Milestone 1 and was processing Milestone 2
2. After generating task lists for Milestone 2 features, paused at milestone_delivery_review
3. Paused reason: "milestone_repair_limit_reached"
4. Milestone 2 has 8 active features after deduplication

**Expected Behaviour**: Auto-runner should continue to next milestone or complete

**Actual Behaviour**: Paused with unclear "repair limit reached" status

**Severity**: High - blocks progress without clear path forward

**Current Status**: Paused at milestone_delivery_review, milestone_repair_count=0

**Generic Fix Recommendations**:
1. Clarify what "repair limit" means in this context
2. If this is milestone scope/delivery review, handle issues automatically
3. Provide user guidance on how to proceed
4. Consider adding skip option for milestone repairs

**Resolution**: Resume accepted - the pause was a checkpoint, not an unrecoverable error. Auto-runner is continuing.

---

### Bug 9: Incorrect Paused Reason When skipReviewSteps=true and Delivery Review Finds needs_human_review Issue

**Timestamp**: 2026-03-31T21:30Z

**Root Cause Analysis**:

The auto-runner paused with `paused_reason = "milestone_repair_limit_reached"` but `milestone_repair_count = 0`. This is misleading.

**Code Path** (auto-advance.ts lines 1883-1924):
1. Delivery review found issue with `action: "needs_human_review"`
2. `hasRepairIssue` = false (because action is NOT "refresh_artifacts")
3. Since `hasRepairIssue` is false, the auto-repair path (lines 1893-1907) is skipped
4. Code falls through to lines 1910-1924 which pauses the session
5. With `autoRepairMilestoneCoverage=true`, it sets `paused_reason: "milestone_repair_limit_reached"` (line 1914-1915)

**The Bug**:
- The pause reason says "repair limit reached" even though NO REPAIR WAS ATTEMPTED
- `milestoneRepairCount` is 0, meaning no repair was tried
- The actual issue is a `needs_human_review` delivery issue that cannot be auto-repaired
- When `skipReviewSteps=true`, the system should skip `needs_human_review` issues, not pause

**Expected Behaviour**:
- With `skipReviewSteps=true`, `needs_human_review` issues should be skipped/ignored
- OR pause reason should be "needs_human" (not "repair limit reached")
- OR repair attempts should only count toward limit when actually attempted

**Actual Behaviour**:
- Paused with misleading "milestone_repair_limit_reached" despite no repair attempts
- Ignores `skipReviewSteps=true` setting for delivery review issues

**Severity**: High - causes confusion about why automation stopped

**Generic Fix Recommendations**:
1. When `skipReviewSteps=true`, ignore `needs_human_review` delivery issues and continue
2. Only use "milestone_repair_limit_reached" when repairs were actually attempted
3. Separate pause reasons for "found needs_human issue" vs "repair limit exhausted"
4. Count repairs accurately - only increment when auto-repair job actually queued

**Impact**: With `skipReviewSteps=true`, the user expects the system to continue without human intervention, but delivery review issues still pause progress.
5. Separate `skipReviewSteps` logic from `autoRepairMilestoneCoverage` logic

---

### Bug 10: Milestone 3 Design Failed with Same Validation Conflicts

**Timestamp**: 2026-03-31T21:33Z

**Short Title**: Third milestone design failure with same pattern

**Details**: GenerateMilestoneDesign for Milestone 3 failed with validation conflicts about:
- Task editing/deletion in scope vs out of scope contradictions
- All Tasks navigation contradictions
- Default category creation ownership ambiguity
- Dependencies and sequencing contradictions

**Pattern**: This is the SAME type of failure seen in Milestones 1 and 2. The milestone design LLM template produces inconsistent internal references across flows, scope boundaries, and delivery shape.

**Severity**: High - requires manual resume for each milestone

**Resolution**: Resume accepted - the pause was a checkpoint, not an unrecoverable error. Auto-runner is continuing.

---

### Bug 11: Milestone 5 Design Failed Twice with Same Validation Conflicts

**Timestamp**: 2026-04-01T00:45Z and 2026-04-01T00:52Z

**Short Title**: Fifth milestone design failure with same pattern, second consecutive milestone with multiple failures

**Details**: GenerateMilestoneDesign for Milestone 5 (Error Handling & Recovery) failed twice:

**First Failure (00:45 UTC):**
- Offline Banner inconsistency across design sections
- Listed as 'In Scope' UI component (separate from Toast System)
- Listed as 'Network Indicator' in Exit Criteria
- Missing from Component inventory in Delivery Shape Group 3
- Delivery Shape Group 2 disclaims UI components (ownership gap)
- Sequencing Phase 4 implies Offline Banner via Toast System (contradiction)

**Second Failure (00:52 UTC):**
- Modal state preservation contradiction
- Scope Boundaries states draft preservation includes 'modal content'
- Flow Step 2 captures 'open modal state'
- Flow Step 6 only restores 'in-progress task input to quick capture field' - no modal restoration
- Exit Criteria only verifies 'Draft task input' - making modal state unverifiable

**Pattern**: This is the SAME type of failure seen in Milestones 1, 2, 3, and 4. Every milestone design has failed at least once on first attempt. The pattern across milestones:
- M1: 1 failure
- M2: 2 failures
- M3: 1 failure
- M4: 1 failure
- M5: 2 failures (so far)

**Severity**: High - requires manual resume for each milestone, extended pauses without intervention

**Impact**: Auto-runner paused for ~5 hours (00:52 UTC to 05:53 UTC) before manual resume

**Action**: Manual resume at 05:53 UTC - third attempt now running

**Generic Fix Recommendations**:
1. Add automatic retry with validation conflict context (same as Bugs 2, 3, 4, 6)
2. Improve milestone design prompt templates to ask for cross-section consistency check
3. Add pre-generation validation of scope, flows, inventory alignment
4. Implement "auto-resume on validation failure" with max 3 retries before pause

---

### Bug 12: Milestone 5 Design Failed Third Time - Validation Conflicts Continue

**Timestamp**: 2026-04-01T06:15Z

**Short Title**: Third attempt at Milestone 5 design also failed with validation conflict

**Details**: GenerateMilestoneDesign for Milestone 5 failed on third attempt:

**Third Failure (06:15 UTC):**
- Draft restoration scope inconsistency
- Scope Boundaries: draft preservation applies to 'edit modal/drawer only' (invokable from any screen)
- Flow 1 step 8: restoration 'on route load' without route qualification
- Exit Criteria: restoration is 'automatic' without specifying screens
- Feature Group 1 'Screens Affected': lists only Dashboard and All Tasks for draft restoration
- Gap: If session expires while editing from Categories or Review, restoration behavior undefined

**Pattern Update**:
- M1: 1 failure → success on attempt 2
- M2: 2 failures → success on attempt 3
- M3: 1 failure → success on attempt 2
- M4: 1 failure → success on attempt 2
- M5: 3 failures (so far) → attempt 4 running

**Severity**: Critical - milestone design generation has ~60-70% first-attempt failure rate, requiring manual intervention for nearly every milestone

**Impact**: 
- Total failed jobs: 13
- Project cannot complete without manual intervention
- Each failure adds ~5-10 minutes of lost time + pause until operator resumes

**Action**: Manual resume at 06:21 UTC - fourth attempt now running
