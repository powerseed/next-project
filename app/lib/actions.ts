'use server';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string(
        {
            invalid_type_error: 'Please select a customer. '
        }),
    amount: z
        .coerce
        .number()
        .gt(
            0,
            {
                message: "Please enter an amount greater than $0. "
            }),
    status: z.enum(
        ['pending', 'paid'],
        {
            invalid_type_error: 'Please select an invoice status.'
        }),
    date: z.string()
});

const CreateAndUpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
    const validatedFields = CreateAndUpdateInvoice.safeParse({
        customerId: formData.get("customerId"),
        amount: formData.get("amount"),
        status: formData.get("status")
    });

    if (!validatedFields.success) {
        return {
            message: "Missing Fields. Failed to Create Invoice. ",
            errors: validatedFields.error.flatten().fieldErrors
        }
    }

    const { customerId, amount, status } = validatedFields.data;

    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try {
        await sql`
            INSERT INTO INVOICES (customer_id, amount, status, date) 
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    }
    catch (e) {
        return {
            message: "Database Error: failed to create invoice."
        }
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function updateInvoice(id: string, formData: FormData) {
    const { customerId, amount, status } = CreateAndUpdateInvoice.parse({
        customerId: formData.get("customerId"),
        amount: formData.get("amount"),
        status: formData.get("status")
    });

    const amountInCents = amount * 100;

    try {
        await sql`
        UPDATE INVOICES 
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
    `;
    }
    catch (e) {
        return {
            message: "Database Error: failed to update invoice."
        }
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    try {
        await sql`
            DELETE FROM INVOICES 
            WHERE id = ${id}
        `;
    } catch (error) {
        return {
            message: "Database Error: Failed to Delete Invoice."
        }
    }

    revalidatePath('/dashboard/invoices');
}

