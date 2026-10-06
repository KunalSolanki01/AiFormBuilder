import { createField } from '@afb/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FormRenderer } from '../src/components/forms/FormRenderer.jsx';
import { useBuilder } from '../src/store/builderStore.js';

const fields = [
  { ...createField('text', new Set(), { label: 'Full Name' }), key: 'name', required: true },
  { ...createField('email', new Set(), { label: 'Email' }), key: 'email', required: true },
  { ...createField('select', new Set(), { label: 'Track', options: ['AI', 'Web'] }), key: 'track' },
];

describe('FormRenderer', () => {
  it('shows validation errors and does not submit invalid data', async () => {
    const onSubmit = vi.fn();
    render(<FormRenderer fields={fields} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findAllByText('This field is required.')).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/Email/), 'nope');
    await userEvent.tab();
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
  });

  it('submits cleaned answers', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(<FormRenderer fields={fields} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/Full Name/), '  Rahul ');
    await userEvent.type(screen.getByLabelText(/Email/), 'Rahul@Example.com');
    await userEvent.selectOptions(screen.getByLabelText(/Track/), 'AI');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Rahul', email: 'rahul@example.com', track: 'AI' }, {}));
  });

  it('maps server field errors back onto fields', async () => {
    const err = Object.assign(new Error('Please fix the highlighted fields.'), {
      details: [{ path: 'email', message: 'Already registered.' }],
    });
    render(<FormRenderer fields={fields} onSubmit={vi.fn().mockRejectedValue(err)} />);
    await userEvent.type(screen.getByLabelText(/Full Name/), 'A');
    await userEvent.type(screen.getByLabelText(/Email/), 'a@b.co');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Already registered.')).toBeInTheDocument();
    expect(screen.getByText('Please fix the highlighted fields.')).toBeInTheDocument();
  });

  it('does not submit in preview mode', async () => {
    const onSubmit = vi.fn();
    render(<FormRenderer fields={[fields[2]]} preview onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Preview only/)).toBeInTheDocument();
  });
});

describe('FormRenderer file upload', () => {
  const fileField = { ...createField('file', new Set(), { label: 'Resume' }), key: 'resume', required: true, fileTypes: ['pdf', 'docx'] };
  const choose = (file) => {
    const input = document.querySelector('input[type=file]');
    fireEvent.change(input, { target: { files: [file] } });
  };
  const pdf = (name = 'cv.pdf', size = 2048) => new File([new Uint8Array(size)], name, { type: 'application/pdf' });

  it('shows the accepted types and size limit', () => {
    render(<FormRenderer fields={[fileField]} onSubmit={vi.fn()} uploadFile={vi.fn()} />);
    expect(screen.getByText('.pdf, .docx · up to 1 MB')).toBeInTheDocument();
    expect(document.querySelector('input[type=file]')).toHaveAttribute('accept', '.pdf,.docx');
  });

  it('rejects wrong types, empty and oversize files without uploading', async () => {
    const upload = vi.fn();
    render(<FormRenderer fields={[fileField]} onSubmit={vi.fn()} uploadFile={upload} />);

    choose(new File(['x'], 'photo.png', { type: 'image/png' }));
    expect(await screen.findByText("That file type isn't allowed. Use: .pdf, .docx.")).toBeInTheDocument();

    choose(pdf('empty.pdf', 0));
    expect(await screen.findByText('That file is empty.')).toBeInTheDocument();

    choose(pdf('big.pdf', 1024 * 1024 + 1));
    expect(await screen.findByText('That file is larger than 1 MB. Please choose a smaller one.')).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads, shows the file, lets it be removed, and submits the reference', async () => {
    const ref = { path: `${crypto.randomUUID()}/${crypto.randomUUID()}.pdf`, name: 'cv.pdf', size: 2048 };
    const upload = vi.fn().mockResolvedValue(ref);
    const onSubmit = vi.fn().mockResolvedValue();
    render(<FormRenderer fields={[fileField]} onSubmit={onSubmit} uploadFile={upload} />);

    choose(pdf());
    expect(await screen.findByText('cv.pdf')).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ key: 'resume' }), expect.any(File));

    await userEvent.click(screen.getByRole('button', { name: 'Remove cv.pdf' }));
    expect(document.querySelector('input[type=file]')).toBeInTheDocument();

    choose(pdf());
    await screen.findByText('cv.pdf');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ resume: ref }, {}));
  });

  it('shows a server error from the upload and keeps the field empty', async () => {
    const upload = vi.fn().mockRejectedValue(new Error("That doesn't look like a real .pdf file."));
    render(<FormRenderer fields={[fileField]} onSubmit={vi.fn()} uploadFile={upload} />);
    choose(pdf());
    expect(await screen.findByText("That doesn't look like a real .pdf file.")).toBeInTheDocument();
    expect(document.querySelector('input[type=file]')).toBeInTheDocument();
  });

  it('disables submit while a file is uploading', async () => {
    let finish;
    const upload = vi.fn(() => new Promise((res) => { finish = res; }));
    render(<FormRenderer fields={[fileField]} onSubmit={vi.fn()} uploadFile={upload} />);
    choose(pdf());
    expect(await screen.findByText(/Uploading cv\.pdf/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    finish({ path: `${crypto.randomUUID()}/${crypto.randomUUID()}.pdf`, name: 'cv.pdf', size: 2048 });
    await screen.findByText('cv.pdf');
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
  });

  it('accepts a file in preview mode without calling the upload API', async () => {
    const upload = vi.fn();
    render(<FormRenderer fields={[fileField]} preview onSubmit={vi.fn()} uploadFile={upload} />);
    choose(pdf());
    expect(await screen.findByText('cv.pdf')).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('FormRenderer Google email verification', () => {
  const emailField = { ...createField('email', new Set(), { label: 'Email' }), key: 'email', required: true, verifyEmail: true };
  const nameField = { ...createField('text', new Set(), { label: 'Name' }), key: 'name', required: true };

  it('shows no typing box; the preview button stands in for the Google button', async () => {
    render(<FormRenderer fields={[emailField]} preview onSubmit={vi.fn()} />);
    expect(document.querySelector('input[type=email]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google (preview)' }));
    expect(await screen.findByText('preview.user@example.com')).toBeInTheDocument();
    expect(screen.getByText('Verified with Google')).toBeInTheDocument();
  });

  it('says verification is unavailable when the form has no client id', () => {
    render(<FormRenderer fields={[emailField]} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Email verification isn't available right now/)).toBeInTheDocument();
  });

  it('refuses to submit until the email is verified', async () => {
    const onSubmit = vi.fn();
    render(<FormRenderer fields={[nameField, emailField]} googleClientId="x.apps.googleusercontent.com" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/Name/), 'Rahul');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('This field is required.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('builder store', () => {
  const s = () => useBuilder.getState();
  beforeEach(() => s().load({ id: 'f1', title: 'T', fields: [] }));

  it('adds, duplicates, reorders and deletes fields with contiguous positions and unique keys', () => {
    s().addField('text');
    s().addField('text');
    expect(s().fields.map((f) => f.key)).toEqual(['untitled_short_text', 'untitled_short_text_2']);

    s().duplicateField(s().fields[0].id);
    expect(s().fields).toHaveLength(3);
    expect(new Set(s().fields.map((f) => f.key)).size).toBe(3);
    expect(s().fields[1].label).toMatch(/\(copy\)$/);

    const lastId = s().fields[2].id;
    s().moveField(2, 0);
    expect(s().fields[0].id).toBe(lastId);
    expect(s().fields.map((f) => f.position)).toEqual([0, 1, 2]);

    s().removeField(lastId);
    expect(s().fields).toHaveLength(2);
    expect(s().dirty).toBe(true);
    s().markSaved();
    expect(s().dirty).toBe(false);
  });

  it('email verification switch: adds a required email question when the form has none', () => {
    s().addField('text');
    s().setEmailVerification(true);
    expect(s().fields[0]).toMatchObject({ type: 'email', label: 'Email address', required: true, verifyEmail: true, position: 0 });
    expect(s().fields.map((f) => f.position)).toEqual([0, 1]);
    expect(s().selectedId).toBe(s().fields[0].id);
  });

  it('email verification switch: uses the first existing email question, only one at a time', () => {
    s().addField('email');
    s().addField('email');
    s().setEmailVerification(true);
    expect(s().fields.map((f) => f.verifyEmail)).toEqual([true, undefined]);
    s().setEmailVerification(true); // idempotent
    expect(s().fields.filter((f) => f.verifyEmail)).toHaveLength(1);
    expect(s().fields).toHaveLength(2);
  });

  it('email verification switch: turning it off clears the requirement but keeps the question', () => {
    s().setEmailVerification(true);
    s().setEmailVerification(false);
    expect(s().fields).toHaveLength(1);
    expect(s().fields[0].verifyEmail).toBeUndefined();
    expect(s().dirty).toBe(true);
  });

  it('duplicating a verified email question does not copy the verification requirement', () => {
    s().setEmailVerification(true);
    s().duplicateField(s().fields[0].id);
    expect(s().fields.map((f) => f.verifyEmail)).toEqual([true, undefined]);
  });

  it('one response per email: only applies while verification is on, and goes away with it', () => {
    s().addField('email');
    s().setUniqueEmail(true); // verification is off, so nothing to attach to
    expect(s().fields[0].uniqueEmail).toBeUndefined();

    s().setEmailVerification(true);
    s().setUniqueEmail(true);
    expect(s().fields[0]).toMatchObject({ verifyEmail: true, uniqueEmail: true });

    s().setEmailVerification(false);
    expect(s().fields[0].verifyEmail).toBeUndefined();
    expect(s().fields[0].uniqueEmail).toBeUndefined();
  });

  it('one response per email is not copied when a verified email question is duplicated', () => {
    s().setEmailVerification(true);
    s().setUniqueEmail(true);
    s().duplicateField(s().fields[0].id);
    expect(s().fields.map((f) => f.uniqueEmail)).toEqual([true, undefined]);
  });

  it('keeps options when switching between option types and adds defaults for new ones', () => {
    const id = s().addField('radio');
    s().updateField(id, { options: ['A', 'B'] });
    s().changeFieldType(id, 'checkbox');
    expect(s().fields[0]).toMatchObject({ type: 'checkbox', options: ['A', 'B'] });
    s().changeFieldType(id, 'rating');
    expect(s().fields[0]).toMatchObject({ type: 'rating', scale: 5 });
    expect(s().fields[0].options).toBeUndefined();
  });
});
