import React, { Fragment } from 'react';
import { MapPin, Phone, Mail, Globe } from 'lucide-react';
import styles from './Invoice.module.css';
import { formatAmount, formatCurrency } from './invoiceModel';
import type { Invoice as InvoiceData, InvoiceLabels, LineItem, Seller, Totals, TaxRates } from './types';

const s = styles as Record<string, string>;

/* ---------------- Small building blocks ---------------- */

const BarHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className={s['inv-bar']}>{children}</div>
);

const AccentBox: React.FC<{ className?: string; title: string; children: React.ReactNode }> = ({
  className,
  title,
  children,
}) => (
  <div className={`${s['inv-accent']} ${className ?? ''}`}>
    <div className={s['inv-accent__bar']} />
    <div>
      <div className={s['inv-accent__title']}>{title}</div>
      <div className={s['inv-accent__text']}>{children}</div>
    </div>
  </div>
);

const KeyValueRows: React.FC<{
  rows: { label: string; value: string }[];
  kClass: string;
  cClass: string;
}> = ({ rows, kClass, cClass }) => (
  <>
    {rows.map((row) => (
      <Fragment key={row.label}>
        <div className={kClass}>{row.label}</div>
        <div className={cClass}>:</div>
        <div>{row.value}</div>
      </Fragment>
    ))}
  </>
);

/* ---------------- Sections ---------------- */

const InvoiceHeader: React.FC<{ seller: Seller }> = ({ seller }) => (
  <header className={s['inv-header']}>
    <div className={s['inv-logo']}>
      {seller.logo ? (
        <img className={s['inv-logo__img']} src={seller.logo} alt={seller.legalName} />
      ) : (
        <div className={s['inv-logo__words']}>
          <div className={s['inv-logo__name']}>{seller.name}</div>
          <div className={s['inv-logo__sub']}>{seller.nameSuffix}</div>
          <div className={s['inv-logo__tagline']}>{seller.tagline}</div>
          <div className={s['inv-logo__rule']} />
        </div>
      )}
    </div>
    <div className={s['inv-contact']}>
      <div className={s['inv-contact__row']}>
        <MapPin className={s['inv-contact__icon']} size={22} strokeWidth={1.8} />
        <div className={s['inv-contact__text']}>
          {seller.address.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      </div>
      <div className={s['inv-contact__row']}>
        <Phone className={s['inv-contact__icon']} size={22} strokeWidth={1.8} />
        <div className={s['inv-contact__text']}>{seller.phone}</div>
      </div>
      <div className={s['inv-contact__row']}>
        <Mail className={s['inv-contact__icon']} size={22} strokeWidth={1.8} />
        <div className={s['inv-contact__text']}>{seller.email}</div>
      </div>
      <div className={s['inv-contact__row']}>
        <Globe className={s['inv-contact__icon']} size={22} strokeWidth={1.8} />
        <div className={s['inv-contact__text']}>{seller.website}</div>
      </div>
    </div>
  </header>
);

const TaxStrip: React.FC<{ seller: Seller; title: string }> = ({ seller, title }) => (
  <div className={s['inv-strip']}>
    <div className={s['inv-strip__item']}>
      <b>GSTIN:</b> {seller.gstin}
    </div>
    <div className={s['inv-strip__divider']} />
    <div className={s['inv-strip__item']}>
      <b>PAN:</b> {seller.pan}
    </div>
    <div className={s['inv-ribbon']}>
      <div className={`${s['inv-ribbon__layer']} ${s['inv-ribbon__layer--copper']}`} />
      <div className={`${s['inv-ribbon__layer']} ${s['inv-ribbon__layer--navy']}`} />
      <div className={s['inv-ribbon__text']}>{title}</div>
    </div>
  </div>
);

const BillTo: React.FC<{ buyer: InvoiceData['buyer']; heading: string }> = ({ buyer, heading }) => (
  <div>
    <div className={s['inv-tag']}>{heading}</div>
    <div className={`${s['inv-box']} ${s['inv-billto__box']}`}>
      <div className={s['inv-billto__name']}>{buyer.name}</div>
      {buyer.address.map((line) => (
        <div className={s['inv-billto__line']} key={line}>
          {line}
        </div>
      ))}
      <div className={`${s['inv-billto__meta']} ${s['inv-kv']}`}>
        <KeyValueRows
          rows={[
            { label: 'GSTIN', value: buyer.gstin },
            { label: 'State', value: buyer.state },
          ]}
          kClass={s['inv-kv__k']}
          cClass={s['inv-kv__c']}
        />
      </div>
    </div>
  </div>
);

const InvoiceDetails: React.FC<{ rows: InvoiceData['meta']; heading: string }> = ({ rows, heading }) => (
  <div>
    <BarHeading>{heading}</BarHeading>
    <div>
      {rows.map((row) => (
        <div className={s['inv-details__row']} key={row.label}>
          <div className={s['inv-details__k']}>{row.label}</div>
          <div className={s['inv-details__c']}>:</div>
          <div className={s['inv-details__v']}>{row.value}</div>
        </div>
      ))}
    </div>
  </div>
);

interface Column {
  key: keyof LineItem;
  head: string[];
  width: string;
  align: string;
  money?: boolean;
}

const ItemsTable: React.FC<{ items: LineItem[]; tax: TaxRates; labels: InvoiceLabels }> = ({
  items,
  tax,
  labels,
}) => {
  const rupee = '\u20B9';
  const columns: Column[] = [
    { key: 'serial', head: [labels.serial], width: '6.0%', align: s['ta-c'] },
    { key: 'description', head: [labels.description], width: '19.0%', align: s['ta-l'] },
    { key: 'hsn', head: [labels.hsn], width: '9.0%', align: s['ta-c'] },
    { key: 'qty', head: [labels.qty], width: '5.6%', align: s['ta-c'] },
    { key: 'unit', head: [labels.unit], width: '5.0%', align: s['ta-c'] },
    { key: 'rate', head: [`${labels.rate} (${rupee})`], width: '7.7%', align: s['ta-r'], money: true },
    {
      key: 'taxableValue',
      head: [labels.taxableValue, `(${rupee})`],
      width: '13.0%',
      align: s['ta-r'],
      money: true,
    },
    { key: 'cgst', head: ['CGST', `${tax.cgstRate}% (${rupee})`], width: '10.8%', align: s['ta-r'], money: true },
    { key: 'sgst', head: ['SGST', `${tax.sgstRate}% (${rupee})`], width: '10.5%', align: s['ta-r'], money: true },
    { key: 'amount', head: [`${labels.amount} (${rupee})`], width: '13.4%', align: s['ta-r'], money: true },
  ];

  return (
    <table className={s['inv-table']}>
      <colgroup>
        {columns.map((c) => (
          <col key={c.key} style={{ width: c.width }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} className={c.align}>
              {c.head.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.serial}>
            {columns.map((c) => (
              <td key={c.key} className={c.align}>
                {c.money ? formatAmount(item[c.key] as number) : String(item[c.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const Totals: React.FC<{ totals: Totals; tax: TaxRates; labels: InvoiceLabels }> = ({ totals, tax, labels }) => {
  const rows = [
    { label: labels.taxableAmount, value: formatCurrency(totals.taxableAmount) },
    { label: `CGST @ ${tax.cgstRate}%`, value: formatCurrency(totals.cgstTotal) },
    { label: `SGST @ ${tax.sgstRate}%`, value: formatCurrency(totals.sgstTotal) },
    { label: labels.roundOff, value: formatCurrency(totals.roundOff) },
  ];
  return (
    <div className={s['inv-totals']}>
      {rows.map((row) => (
        <Fragment key={row.label}>
          <div className={s['inv-totals__k']}>{row.label}</div>
          <div className={s['inv-totals__v']}>{row.value}</div>
        </Fragment>
      ))}
      <div className={`${s['inv-totals__k']} ${s['inv-totals__k--grand']}`}>{labels.grandTotal}</div>
      <div className={`${s['inv-totals__v']} ${s['inv-totals__v--grand']}`}>{formatCurrency(totals.grandTotal)}</div>
    </div>
  );
};

const BankDetails: React.FC<{ bank: InvoiceData['bank']; heading: string }> = ({ bank, heading }) => (
  <section className={s['inv-bank']}>
    <BarHeading>{heading}</BarHeading>
    <div className={`${s['inv-box']} ${s['inv-bank__box']}`}>
      <div className={s['inv-bank__grid']}>
        <KeyValueRows
          rows={[
            { label: 'Account Name', value: bank.accountName },
            { label: 'Bank Name', value: bank.bankName },
            { label: 'Account No.', value: bank.accountNumber },
            { label: 'IFSC Code', value: bank.ifsc },
            { label: 'Branch', value: bank.branch },
          ]}
          kClass={s['inv-bank__k']}
          cClass={s['inv-bank__c']}
        />
      </div>
    </div>
  </section>
);

const Signature: React.FC<{ seller: Seller; labels: InvoiceLabels }> = ({ seller, labels }) => (
  <div className={s['inv-sign']}>
    <div className={s['inv-sign__for']}>
      For <b>{seller.legalName}</b>
    </div>
    <div className={s['inv-sign__line']} />
    <div className={s['inv-sign__role']}>{labels.signatory}</div>
  </div>
);

const InvoiceFooter: React.FC<{ footer: InvoiceData['footer'] }> = ({ footer }) => (
  <footer className={s['inv-footer']}>
    <div className={s['inv-footer__wedge']} />
    <div className={s['inv-footer__band']} />
    <div className={s['inv-footer__slash']} />
    <div className={s['inv-footer__text']}>
      <span className={s['inv-footer__left']}>{footer.left}</span>
      <span className={s['inv-footer__right']}>{footer.right}</span>
    </div>
  </footer>
);

/* ---------------- Root ---------------- */

const DEFAULT_LABELS: InvoiceLabels = {
  title: 'TAX INVOICE',
  billTo: 'BILL TO',
  invoiceDetails: 'INVOICE DETAILS',
  bankDetails: 'Bank Details',
  amountInWords: 'Amount in Words',
  declaration: 'Declaration',
  signatory: 'Authorized Signatory',
  taxableAmount: 'Taxable Amount',
  roundOff: 'Round Off',
  grandTotal: 'Grand Total',
  serial: 'S.No.',
  description: 'Description of Goods',
  hsn: 'HSN/SAC',
  qty: 'Qty',
  unit: 'Unit',
  rate: 'Rate',
  taxableValue: 'Taxable Value',
  amount: 'Amount',
};

export interface InvoiceProps {
  invoice: InvoiceData;
  labels?: Partial<InvoiceLabels>;
  /** Forwarded to the root <article>, e.g. for react-to-print's contentRef. */
  className?: string;
}

const Invoice = React.forwardRef<HTMLElement, InvoiceProps>(({ invoice, labels: labelOverrides, className }, ref) => {
  const labels: InvoiceLabels = { ...DEFAULT_LABELS, ...labelOverrides };
  const { seller, buyer, meta, items, tax, totals, bank, declaration, footer, amountInWords } = invoice;

  return (
    <article ref={ref} className={`${s['inv']} ${className ?? ''}`}>
      <InvoiceHeader seller={seller} />
      <TaxStrip seller={seller} title={labels.title} />

      <div className={s['inv__body']}>
        <section className={s['inv-info']}>
          <BillTo buyer={buyer} heading={labels.billTo} />
          <InvoiceDetails rows={meta} heading={labels.invoiceDetails} />
        </section>

        <ItemsTable items={items} tax={tax} labels={labels} />

        <section className={s['inv-summary']}>
          <AccentBox className={s['inv-words']} title={labels.amountInWords}>
            {amountInWords}
          </AccentBox>
          <Totals totals={totals} tax={tax} labels={labels} />
        </section>

        <BankDetails bank={bank} heading={labels.bankDetails} />

        <section className={s['inv-foot-row']}>
          <AccentBox className={s['inv-decl']} title={labels.declaration}>
            {declaration}
          </AccentBox>
          <Signature seller={seller} labels={labels} />
        </section>
      </div>

      <InvoiceFooter footer={footer} />
    </article>
  );
});

Invoice.displayName = 'Invoice';
export default Invoice;
