import React from 'react';
import { formatAmount, formatCurrency } from './invoiceModel';
import './invoice.css';

/* ---------------- Graphics ---------------- */

const Icon = ({ name }) => {
  const paths = {
    pin: <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />,
    phone: <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z" />,
    mail: <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4.25-8 4.75-8-4.75V6l8 4.75L20 6v2.25z" />,
    web: (
      <g fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9.2" />
        <ellipse cx="12" cy="12" rx="4.2" ry="9.2" />
        <path d="M2.8 12h18.4M4.4 7h15.2M4.4 17h15.2" />
      </g>
    )
  };
  return (
    <svg className="inv-contact__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {paths[name]}
    </svg>
  );
};

/* ---------------- Small building blocks ---------------- */

const BarHeading = ({ children }) => <div className="inv-bar">{children}</div>;

const AccentBox = ({ className, title, children }) => (
  <div className={'inv-accent ' + (className || '')}>
    <div className="inv-accent__bar" />
    <div>
      <div className="inv-accent__title">{title}</div>
      <div className="inv-accent__text">{children}</div>
    </div>
  </div>
);

const KeyValueRows = ({ rows, gridClass, kClass, cClass }) =>
  rows.map((row) => (
    <React.Fragment key={row.label}>
      <div className={kClass}>{row.label}</div>
      <div className={cClass}>:</div>
      <div>{row.value}</div>
    </React.Fragment>
  ));

/* ---------------- Sections ---------------- */

const InvoiceHeader = ({ seller }) => (
  <header className="inv-header">
    <div className="inv-logo">
      {seller.logo ? (
        <img className="inv-logo__img" src={seller.logo} alt={seller.legalName} />
      ) : (
        <div className="inv-logo__words">
          <div className="inv-logo__name">{seller.name}</div>
          <div className="inv-logo__sub">{seller.nameSuffix}</div>
          <div className="inv-logo__tagline">{seller.tagline}</div>
          <div className="inv-logo__rule" />
        </div>
      )}
    </div>
    <div className="inv-contact">
      <div className="inv-contact__row">
        <Icon name="pin" />
        <div className="inv-contact__text">
          {seller.address.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      </div>
      <div className="inv-contact__row">
        <Icon name="phone" />
        <div className="inv-contact__text">{seller.phone}</div>
      </div>
      <div className="inv-contact__row">
        <Icon name="mail" />
        <div className="inv-contact__text">{seller.email}</div>
      </div>
      <div className="inv-contact__row">
        <Icon name="web" />
        <div className="inv-contact__text">{seller.website}</div>
      </div>
    </div>
  </header>
);

const TaxStrip = ({ seller, title }) => (
  <div className="inv-strip">
    <div className="inv-strip__item">
      <b>GSTIN:</b> {seller.gstin}
    </div>
    <div className="inv-strip__divider" />
    <div className="inv-strip__item">
      <b>PAN:</b> {seller.pan}
    </div>
    <div className="inv-ribbon">
      <div className="inv-ribbon__layer inv-ribbon__layer--copper" />
      <div className="inv-ribbon__layer inv-ribbon__layer--navy" />
      <div className="inv-ribbon__text">{title}</div>
    </div>
  </div>
);

const BillTo = ({ buyer, heading }) => (
  <div>
    <div className="inv-tag">{heading}</div>
    <div className="inv-box inv-billto__box">
      <div className="inv-billto__name">{buyer.name}</div>
      {buyer.address.map((line) => (
        <div className="inv-billto__line" key={line}>
          {line}
        </div>
      ))}
      <div className="inv-billto__meta inv-kv">
        <KeyValueRows
          rows={[
            { label: 'GSTIN', value: buyer.gstin },
            { label: 'State', value: buyer.state }
          ]}
          kClass="inv-kv__k"
          cClass="inv-kv__c"
        />
      </div>
    </div>
  </div>
);

const InvoiceDetails = ({ rows, heading }) => (
  <div>
    <BarHeading>{heading}</BarHeading>
    <div>
      {rows.map((row) => (
        <div className="inv-details__row" key={row.label}>
          <div className="inv-details__k">{row.label}</div>
          <div className="inv-details__c">:</div>
          <div className="inv-details__v">{row.value}</div>
        </div>
      ))}
    </div>
  </div>
);

const ItemsTable = ({ items, tax, labels }) => {
  const rupee = '\u20B9';
  const columns = [
    { key: 'serial', head: [labels.serial], width: '6.0%', align: 'ta-c' },
    { key: 'description', head: [labels.description], width: '19.0%', align: 'ta-l' },
    { key: 'hsn', head: [labels.hsn], width: '9.0%', align: 'ta-c' },
    { key: 'qty', head: [labels.qty], width: '5.6%', align: 'ta-c' },
    { key: 'unit', head: [labels.unit], width: '5.0%', align: 'ta-c' },
    { key: 'rate', head: [labels.rate + ' (' + rupee + ')'], width: '7.7%', align: 'ta-r', money: true },
    { key: 'taxableValue', head: [labels.taxableValue, '(' + rupee + ')'], width: '13.0%', align: 'ta-r', money: true },
    { key: 'cgst', head: ['CGST', tax.cgstRate + '% (' + rupee + ')'], width: '10.8%', align: 'ta-r', money: true },
    { key: 'sgst', head: ['SGST', tax.sgstRate + '% (' + rupee + ')'], width: '10.5%', align: 'ta-r', money: true },
    { key: 'amount', head: [labels.amount + ' (' + rupee + ')'], width: '13.4%', align: 'ta-r', money: true }
  ];

  return (
    <table className="inv-table">
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
                {c.money ? formatAmount(item[c.key]) : item[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const Totals = ({ totals, tax, labels }) => {
  const rows = [
    { label: labels.taxableAmount, value: formatCurrency(totals.taxableAmount) },
    { label: 'CGST @ ' + tax.cgstRate + '%', value: formatCurrency(totals.cgstTotal) },
    { label: 'SGST @ ' + tax.sgstRate + '%', value: formatCurrency(totals.sgstTotal) },
    { label: labels.roundOff, value: formatCurrency(totals.roundOff) }
  ];
  return (
    <div className="inv-totals">
      {rows.map((row) => (
        <React.Fragment key={row.label}>
          <div className="inv-totals__k">{row.label}</div>
          <div className="inv-totals__v">{row.value}</div>
        </React.Fragment>
      ))}
      <div className="inv-totals__k inv-totals__k--grand">{labels.grandTotal}</div>
      <div className="inv-totals__v inv-totals__v--grand">{formatCurrency(totals.grandTotal)}</div>
    </div>
  );
};

const BankDetails = ({ bank, heading }) => (
  <section className="inv-bank">
    <BarHeading>{heading}</BarHeading>
    <div className="inv-box inv-bank__box">
      <div className="inv-bank__grid">
        <KeyValueRows
          rows={[
            { label: 'Account Name', value: bank.accountName },
            { label: 'Bank Name', value: bank.bankName },
            { label: 'Account No.', value: bank.accountNumber },
            { label: 'IFSC Code', value: bank.ifsc },
            { label: 'Branch', value: bank.branch }
          ]}
          kClass="inv-bank__k"
          cClass="inv-bank__c"
        />
      </div>
    </div>
  </section>
);

const Signature = ({ seller, labels }) => (
  <div className="inv-sign">
    <div className="inv-sign__for">
      For <b>{seller.legalName}</b>
    </div>
    <div className="inv-sign__line" />
    <div className="inv-sign__role">{labels.signatory}</div>
  </div>
);

const InvoiceFooter = ({ footer }) => (
  <footer className="inv-footer">
    <div className="inv-footer__wedge" />
    <div className="inv-footer__band" />
    <div className="inv-footer__slash" />
    <div className="inv-footer__text">
      <span className="inv-footer__left">{footer.left}</span>
      <span className="inv-footer__right">{footer.right}</span>
    </div>
  </footer>
);

/* ---------------- Root ---------------- */

const DEFAULT_LABELS = {
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
  amount: 'Amount'
};

/**
 * @param {object} invoice  Output of buildInvoice() from invoiceModel.js
 * @param {object} [labels] Optional label overrides
 */
export default function Invoice({ invoice, labels: labelOverrides }) {
  if (!invoice) return null;
  const labels = { ...DEFAULT_LABELS, ...(labelOverrides || {}) };
  const { seller, buyer, meta, items, tax, totals, bank, declaration, footer, amountInWords } = invoice;

  return (
    <article className="inv">
      <InvoiceHeader seller={seller} />
      <TaxStrip seller={seller} title={labels.title} />

      <div className="inv__body">
        <section className="inv-info">
          <BillTo buyer={buyer} heading={labels.billTo} />
          <InvoiceDetails rows={meta} heading={labels.invoiceDetails} />
        </section>

        <ItemsTable items={items} tax={tax} labels={labels} />

        <section className="inv-summary">
          <AccentBox className="inv-words" title={labels.amountInWords}>
            {amountInWords}
          </AccentBox>
          <Totals totals={totals} tax={tax} labels={labels} />
        </section>

        <BankDetails bank={bank} heading={labels.bankDetails} />

        <section className="inv-foot-row">
          <AccentBox className="inv-decl" title={labels.declaration}>
            {declaration}
          </AccentBox>
          <Signature seller={seller} labels={labels} />
        </section>
      </div>

      <InvoiceFooter footer={footer} />
    </article>
  );
}
