import * as mustache from 'mustache';
import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import { JobStatus } from '../../app/models/job';
import hookServersStartStop from '../helpers/servers';
import { hookTransaction } from '../helpers/db';
import { buildJob } from '../helpers/jobs';
import { hookWorkflowUIJobRows } from '../helpers/workflow-ui';


// main objects used in the tests
const boJob1 = buildJob({ status: JobStatus.FAILED, username: 'bo' });
const boJob2 = buildJob({ status: JobStatus.SUCCESSFUL, username: 'bo' });
const adamJob1 = buildJob({ status: JobStatus.RUNNING, username: 'adam' });


describe('Workflow UI job table rows route', function () {
  hookServersStartStop({ skipEarthdataLogin: false });

  hookTransaction();
  before(async function () {
    await boJob1.save(this.trx);
    await boJob2.save(this.trx);
    await adamJob1.save(this.trx);
    this.trx.commit();
  });

  describe('for an invalid job ID format', function () {
    hookWorkflowUIJobRows({ jobIDs: ['not-a-uuid'], username: 'bo' });
    it('returns an error', function () {
      const response = JSON.parse(this.res.text);
      expect(response).to.eql({
        code: 'harmony.RequestValidationError',
        description: 'Error: Invalid format for Job ID \'not-a-uuid\'. Job ID must be a UUID.',
      });
    });
  });

  describe('who requests their SUCCESSFUL jobs', function () {
    hookWorkflowUIJobRows({ username: 'bo', jobIDs: [boJob1.jobID, boJob2.jobID], query: { tableFilter: '[{"value":"status: successful","dbValue":"successful","field":"status"}]' } });
    it('returns only the successful job row', function () {
      const response = JSON.parse(this.res.text);
      expect(response[boJob1.jobID]).to.eq(undefined);
      expect(response[boJob2.jobID]).contains(`<tr id="job-${boJob2.jobID}" class='job-table-row'>`);
      console.log(typeof response);
      expect(Object.keys(response).length).to.eq(1);
    });
  });

  describe('whose request includes someone else\'s job (but is an admin)', function () {
    hookWorkflowUIJobRows({ username: 'adam', jobIDs: [boJob1.jobID, adamJob1.jobID] });
    it('returns the other user\'s job rows', async function () {
      const response = JSON.parse(this.res.text);
      expect(response[adamJob1.jobID]).contains(`<tr id="job-${adamJob1.jobID}" class='job-table-row'>`);
      expect(response[boJob1.jobID]).contains(`<tr id="job-${boJob1.jobID}" class='job-table-row'>`);
      expect(Object.keys(response).length).to.eq(2);
    });
  });


  describe('who requests someone else\'s job (but is NOT an admin)', function () {
    hookWorkflowUIJobRows({ username: 'bo', jobIDs: [adamJob1.jobID] });
    it('returns undefined', async function () {
      const response = JSON.parse(this.res.text);
      expect(response[adamJob1.jobID]).to.eq(undefined);
      expect(Object.keys(response).length).to.eq(0);
    });
  });
});
