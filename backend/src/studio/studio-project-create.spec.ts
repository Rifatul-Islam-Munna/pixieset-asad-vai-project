import { BadRequestException } from '@nestjs/common';
import { StudioService } from './studio.service';

const contactId = '123456789012345678901234';
function fixture() {
  const query: any = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  };
  const model: any = {
    find: jest.fn().mockReturnValue(query),
    countDocuments: jest.fn().mockResolvedValue(0),
    exists: jest.fn().mockResolvedValue({ _id: contactId }),
    create: jest.fn(async (record: Record<string, unknown>) => ({
      toObject: () => ({ _id: '223456789012345678901234', ...record }),
    })),
  };
  const service = new StudioService(model as any, {} as any, {} as any);
  return { service, model, query };
}

describe('Studio Project quick creation and contact search', () => {
  it('searches the authenticated studio contacts by name or email', async () => {
    const { service, model, query } = fixture();
    await service.list('studio-A', 'contacts', { search: 'Jane', limit: 20 });
    const filter = model.find.mock.calls[0][0];
    expect(filter).toMatchObject({ userId: 'studio-A', kind: 'contacts' });
    expect(filter.$or).toEqual([
      { title: { $regex: 'Jane', $options: 'i' } },
      { email: { $regex: 'Jane', $options: 'i' } },
    ]);
    expect(model.countDocuments).toHaveBeenCalledWith(filter);
    expect(query.limit).toHaveBeenCalledWith(20);
  });

  it('searches text literally instead of running user-provided regex syntax', async () => {
    const { service, model } = fixture();
    await service.list('studio-A', 'contacts', { search: 'Jane.*' });
    const filter = model.find.mock.calls[0][0];
    const expression = new RegExp(filter.$or[0].title.$regex, 'i');
    expect(expression.test('Jane.*')).toBe(true);
    expect(expression.test('Jane Anything')).toBe(false);
  });

  it('creates a contact that can be selected immediately during project creation', async () => {
    const { service, model } = fixture();
    const result = await service.create('studio-A', 'contacts', {
      title: 'Jane Smith', type: 'client', status: 'client',
      email: 'jane@example.com', phone: '1234567',
      details: { firstName: 'Jane', lastName: 'Smith', source: 'project-creation' },
    });
    expect(result).toMatchObject({
      userId: 'studio-A', kind: 'contacts', title: 'Jane Smith',
      status: 'client', email: 'jane@example.com',
    });
    expect(model.create).toHaveBeenCalledTimes(1);
  });

  it('creates an inquiry project linked to the chosen owner-owned contact', async () => {
    const { service, model } = fixture();
    const result = await service.create('studio-A', 'projects', {
      title: 'Smith Family Portrait', type: 'portrait', status: 'inquiry',
      contactId,
    });
    expect(model.exists).toHaveBeenCalledWith({
      userId: 'studio-A', kind: 'contacts', _id: contactId,
    });
    expect(result).toMatchObject({
      userId: 'studio-A', kind: 'projects', title: 'Smith Family Portrait',
      type: 'portrait', status: 'inquiry', contactId,
    });
  });

  it('rejects creating a new project without selecting a contact', async () => {
    const { service, model } = fixture();
    await expect(service.create('studio-A', 'projects', {
      title: 'Unlinked project', type: 'portrait',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('rejects a contact from another studio before saving a project', async () => {
    const { service, model } = fixture();
    model.exists.mockResolvedValue(null);
    await expect(service.create('studio-A', 'projects', {
      title: 'Other studio project', type: 'wedding', contactId,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });
});
