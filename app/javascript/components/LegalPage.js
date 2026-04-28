import React from 'react';

// =====================================================================
// Centralized constants. Counsel review and final values land here.
// Each PLACEHOLDER is intentional and visible until replaced.
// =====================================================================

const COMPANY = {
  legalName: 'Linchpin Industries, LLC',
  product: 'Map My Research',
  productUrl: 'https://mapmyresearch.com',
  parentUrl: 'https://linchpinindustries.com',
  // Mailing address used for legal notices and the DMCA agent registration.
  address: '10 Oak View Drive, Aliso Viejo, CA 92656',
  governingLaw: 'the State of California',
  venue: 'Orange County, California',
  // Single support inbox routes everything for now.
  // Split into role addresses (legal@, dmca@, etc.) when the volume justifies it.
  emails: {
    contact: 'support@mapmyresearch.com',
    legal: 'support@mapmyresearch.com',
    privacy: 'support@mapmyresearch.com',
    dmca: 'support@mapmyresearch.com',
    security: 'support@mapmyresearch.com',
    accessibility: 'support@mapmyresearch.com',
    abuse: 'support@mapmyresearch.com',
  },
  dmcaAgent: {
    name: 'Elizabeth Bayardelle',
    title: 'DMCA Designated Agent',
    address: '10 Oak View Drive, Aliso Viejo, CA 92656',
    email: 'support@mapmyresearch.com',
    phone: '(949) 540-1443',
  },
};

// =====================================================================
// Page registry. Order is the order shown on the index.
// Update `updated` when you ship a substantive change.
// `draft: false` shows a banner above the page.
// =====================================================================

const PAGES = [
  { slug: 'terms', title: 'Terms of Service', summary: 'The agreement between you and Map My Research.', updated: '2026-04-26', draft: false },
  { slug: 'privacy', title: 'Privacy Policy', summary: 'What we collect, why, and what we do with it.', updated: '2026-04-26', draft: false },
  { slug: 'cookies', title: 'Cookie Notice', summary: 'Cookies we set, and what they do.', updated: '2026-04-26', draft: false },
  { slug: 'acceptable-use', title: 'Acceptable Use Policy', summary: 'What you can and cannot do on the service.', updated: '2026-04-26', draft: false },
  { slug: 'dmca', title: 'Copyright and DMCA Policy', summary: 'How to report infringement, how we respond.', updated: '2026-04-26', draft: false },
  { slug: 'refunds', title: 'Refund Policy', summary: 'When refunds are issued, and how to request one.', updated: '2026-04-26', draft: false },
  { slug: 'ai', title: 'AI Use and Content Policy', summary: 'How AI features work and what happens to your content.', updated: '2026-04-27', draft: false },
  { slug: 'subprocessors', title: 'Subprocessors', summary: 'Third parties that process data on our behalf.', updated: '2026-04-26', draft: false },
  { slug: 'accessibility', title: 'Accessibility Statement', summary: 'Where we are with accessibility, and how to report issues.', updated: '2026-04-26', draft: false },
  { slug: 'security', title: 'Security Overview', summary: 'How we protect accounts, content, and payments.', updated: '2026-04-26', draft: false },
];

// =====================================================================
// Top-level component
// =====================================================================

export default function LegalPage({ slug }) {
  if (!slug) return <LegalIndex />;
  const page = PAGES.find((p) => p.slug === slug);
  if (!page) return <NotFound />;

  return (
    <LegalShell page={page}>
      <PageBody slug={slug} />
    </LegalShell>
  );
}

function PageBody({ slug }) {
  switch (slug) {
    case 'terms':
      return <TermsOfService />;
    case 'privacy':
      return <PrivacyPolicy />;
    case 'cookies':
      return <CookieNotice />;
    case 'acceptable-use':
      return <AcceptableUsePolicy />;
    case 'dmca':
      return <DmcaPolicy />;
    case 'refunds':
      return <RefundPolicy />;
    case 'ai':
      return <AiPolicy />;
    case 'subprocessors':
      return <Subprocessors />;
    case 'accessibility':
      return <AccessibilityStatement />;
    case 'security':
      return <SecurityOverview />;
    default:
      return <ComingSoon />;
  }
}

// =====================================================================
// Shells
// =====================================================================

function LegalIndex() {
  return (
    <div style={pageStyles.outer}>
      <div style={pageStyles.column}>
        <div style={pageStyles.eyebrow}>{COMPANY.legalName}</div>
        <h1 style={pageStyles.indexTitle}>Legal</h1>
        <p style={pageStyles.lede}>
          The agreements that govern your use of {COMPANY.product}, and the
          policies that explain how we operate. If anything here is unclear,
          write to{' '}
          <a href={`mailto:${COMPANY.emails.legal}`} style={pageStyles.link}>
            {COMPANY.emails.legal}
          </a>
          .
        </p>

        <ul style={pageStyles.indexList}>
          {PAGES.map((p) => (
            <li key={p.slug} style={pageStyles.indexItem}>
              <a href={`/legal/${p.slug}`} style={pageStyles.indexLink}>
                <div style={pageStyles.indexItemTitleRow}>
                  <span style={pageStyles.indexItemTitle}>{p.title}</span>
                  {p.draft && <span style={pageStyles.draftPill}>Draft</span>}
                </div>
                <div style={pageStyles.indexItemSummary}>{p.summary}</div>
                <div style={pageStyles.indexItemMeta}>Updated {p.updated}</div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LegalShell({ page, children }) {
  return (
    <div style={pageStyles.outer}>
      <div style={pageStyles.column}>
        <a href="/legal" style={pageStyles.backLink}>
          ← All legal documents
        </a>
        <div style={pageStyles.eyebrow}>{COMPANY.legalName}</div>
        <h1 style={pageStyles.title}>{page.title}</h1>
        <div style={pageStyles.metaRow}>
          <span>Last updated {page.updated}</span>
          {page.draft && <span style={pageStyles.draftPill}>Draft</span>}
        </div>

        {page.draft && (
          <DraftBanner>
            This is a draft pending counsel review. It is published for
            transparency and is not a substitute for the final, executed
            version.
          </DraftBanner>
        )}

        <div style={pageStyles.body}>{children}</div>

        <div style={pageStyles.docFooter}>
          Questions about this document? Email{' '}
          <a href={`mailto:${COMPANY.emails.legal}`} style={pageStyles.link}>
            {COMPANY.emails.legal}
          </a>
          .
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div style={pageStyles.outer}>
      <div style={pageStyles.column}>
        <h1 style={pageStyles.title}>Not found</h1>
        <p style={pageStyles.lede}>
          This page does not exist.{' '}
          <a href="/legal" style={pageStyles.link}>
            Return to the legal index.
          </a>
        </p>
      </div>
    </div>
  );
}

function ComingSoon() {
  return (
    <P>
      This page is being drafted. It will be published here when ready.
      Questions in the meantime go to{' '}
      <A href={`mailto:${COMPANY.emails.legal}`}>{COMPANY.emails.legal}</A>.
    </P>
  );
}

// =====================================================================
// Document primitives
// =====================================================================

function Sec({ n, title, children }) {
  return (
    <section style={primStyles.section} id={`section-${n}`}>
      <h2 style={primStyles.h2}>
        <span style={primStyles.h2Num}>{n}.</span>
        <span>{title}</span>
      </h2>
      {children}
    </section>
  );
}

function Sub({ title, children }) {
  return (
    <div style={primStyles.sub}>
      <h3 style={primStyles.h3}>{title}</h3>
      {children}
    </div>
  );
}

function P({ children }) {
  return <p style={primStyles.p}>{children}</p>;
}

function L({ items }) {
  return (
    <ul style={primStyles.ul}>
      {items.map((it, i) => (
        <li key={i} style={primStyles.li}>{it}</li>
      ))}
    </ul>
  );
}

function A({ href, children }) {
  const external = href.startsWith('http');
  return (
    <a
      href={href}
      style={pageStyles.link}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}

function Note({ children }) {
  return <div style={primStyles.note}>{children}</div>;
}

function DraftBanner({ children }) {
  return <div style={primStyles.draftBanner}>{children}</div>;
}

function ContactBlock({ lines }) {
  return (
    <div style={primStyles.contact}>
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

// =====================================================================
// Pages
// =====================================================================

function TermsOfService() {
  return (
    <>
      <P>
        These Terms of Service (the &ldquo;Terms&rdquo;) govern your use of{' '}
        {COMPANY.product}, a research workspace operated by {COMPANY.legalName}{' '}
        (&ldquo;{COMPANY.legalName}&rdquo;, &ldquo;we,&rdquo; or
        &ldquo;us&rdquo;). By creating an account or using the service, you
        agree to these Terms. If you do not agree, do not use the service.
      </P>
      <P>
        Read these in full. They limit our liability and explain how disputes
        are resolved. The capitalized terms have the meanings given to them
        below or where they first appear.
      </P>

      <Sec n="1" title="Who we are">
        <P>
          {COMPANY.product} is a workspace for organizing and cross-referencing
          academic literature. It is operated by {COMPANY.legalName}, organized
          in {COMPANY.venue}. Our address is {COMPANY.address}. For questions
          about these Terms, write to{' '}
          <A href={`mailto:${COMPANY.emails.legal}`}>{COMPANY.emails.legal}</A>.
        </P>
      </Sec>

      <Sec n="2" title="Eligibility and accounts">
        <P>
          You must be at least 18 years old, or the age of majority in your
          jurisdiction, to use the service. By creating an account, you confirm
          that the information you provide is accurate and that you have the
          authority to agree to these Terms.
        </P>
        <P>
          You are responsible for activity on your account and for keeping your
          credentials secure. Notify us at{' '}
          <A href={`mailto:${COMPANY.emails.security}`}>
            {COMPANY.emails.security}
          </A>{' '}
          if you suspect unauthorized access. You may not share an account or
          let another person use your account on your behalf.
        </P>
      </Sec>

      <Sec n="3" title="License to use the service">
        <P>
          Subject to these Terms, we grant you a limited, non-exclusive,
          non-transferable, revocable license to access and use the service for
          your own research and study. You may not resell, sublicense, or make
          the service available to third parties except as the service itself
          allows (for example, by inviting collaborators to a shared
          collection).
        </P>
      </Sec>

      <Sec n="4" title="Your content">
        <P>
          You retain ownership of the content you upload, create, or store on
          the service, including PDFs, notes, highlights, tags, concepts,
          collections, and other research artifacts (your &ldquo;Content&rdquo;).
          You are responsible for your Content and for having the rights you
          need to upload and use it.
        </P>
        <P>
          You grant {COMPANY.legalName} a worldwide, non-exclusive, royalty-free
          license to host, store, copy, transmit, display, and process your
          Content solely to operate, secure, and improve the service for you,
          including to:
        </P>
        <L
          items={[
            'Store and serve your Content to you and to people you share it with.',
            'Run automated processes you initiate, such as metadata extraction, concept suggestion, and search indexing.',
            'Generate backups, prevent loss, and recover accounts.',
            'Investigate suspected violations of these Terms or applicable law.',
          ]}
        />
        <P>
          We do not sell your Content. We do not use your Content to train
          third-party models. See the{' '}
          <A href="/legal/ai">AI Use and Content Policy</A> for the full
          treatment of AI features.
        </P>
      </Sec>

      <Sec n="5" title="Acceptable use">
        <P>
          Your use of the service must comply with our{' '}
          <A href="/legal/acceptable-use">Acceptable Use Policy</A>. In short:
          do not upload content you do not have the right to upload, do not
          attempt to break the service, and do not use the service to harm
          others.
        </P>
      </Sec>

      <Sec n="6" title="Sharing and collaboration">
        <P>
          You may share collections, concepts, and sources with other users at
          permission levels we offer (such as viewer, editor, or collaborator).
          When you share, you authorize us to make the shared items accessible
          to the people you share them with, at the permission level you set,
          for as long as the share is active. You are responsible for who you
          share with and for revoking access when it is no longer appropriate.
        </P>
      </Sec>

      <Sec n="7" title="Purchases, packs, and subscriptions">
        <P>
          The service offers paid content (&ldquo;Packs&rdquo;) and may offer
          subscription plans. Prices, taxes, and any recurring billing terms
          are shown at checkout. Payments are processed by Stripe; by paying,
          you also agree to Stripe&apos;s terms.
        </P>
        <P>
          Refunds are governed by our{' '}
          <A href="/legal/refunds">Refund Policy</A>. We may change prices for
          future purchases or for the next billing period of an active
          subscription. We will give reasonable notice of price changes that
          affect a renewal. You may cancel before the renewal to avoid the
          new price.
        </P>
      </Sec>

      <Sec n="8" title="Third-party services">
        <P>
          The service relies on third parties to function. We use Stripe for
          payments, Amazon Web Services for storage and hosting, SendGrid for
          email, Anthropic for AI features, and the public ORCID registry for
          author enrichment. The current list is maintained on our{' '}
          <A href="/legal/subprocessors">Subprocessors page</A>.
        </P>
        <P>
          The service may also link to or integrate with third-party sites and
          tools we do not control. Your use of those is governed by their
          terms, not ours.
        </P>
      </Sec>

      <Sec n="9" title="Privacy">
        <P>
          Our handling of personal information is described in the{' '}
          <A href="/legal/privacy">Privacy Policy</A>. Cookies and similar
          technologies are described in the{' '}
          <A href="/legal/cookies">Cookie Notice</A>.
        </P>
      </Sec>

      <Sec n="10" title="Intellectual property">
        <P>
          The service, including its software, design, text, and trademarks, is
          owned by {COMPANY.legalName} or its licensors and is protected by
          intellectual property laws. These Terms do not transfer any
          {' '}{COMPANY.legalName} intellectual property to you, and we reserve
          all rights not expressly granted.
        </P>
        <P>
          If you send us feedback or suggestions, you grant us a perpetual,
          irrevocable, royalty-free license to use them without obligation to
          you.
        </P>
      </Sec>

      <Sec n="11" title="Copyright complaints">
        <P>
          We respond to notices of alleged copyright infringement under the
          Digital Millennium Copyright Act. To submit a notice, follow the
          procedure in our{' '}
          <A href="/legal/dmca">Copyright and DMCA Policy</A>. Repeat
          infringers will have their accounts terminated.
        </P>
      </Sec>

      <Sec n="12" title="Suspension and termination">
        <P>
          You may stop using the service at any time and delete your account
          from the settings page. We may suspend or terminate your access if
          you violate these Terms, if your use puts the service or other users
          at risk, or if we are required to do so by law.
        </P>
        <P>
          On termination, your license to use the service ends. We will, on
          request and within a reasonable window, allow you to export your
          Content. After that window, we may delete your Content. Sections that
          by their nature should survive termination will survive, including
          the sections on your content license to us, intellectual property,
          disclaimers, limitation of liability, indemnification, and governing
          law.
        </P>
      </Sec>

      <Sec n="13" title="Disclaimers">
        <P>
          The service is provided on an &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; basis. To the maximum extent permitted by law,
          {' '}{COMPANY.legalName} disclaims all warranties, express or
          implied, including merchantability, fitness for a particular purpose,
          and non-infringement. We do not warrant that the service will be
          uninterrupted, error-free, or secure, or that any AI-generated output
          will be accurate, complete, or suitable for your purpose. You are
          responsible for verifying outputs before relying on them.
        </P>
      </Sec>

      <Sec n="14" title="Limitation of liability">
        <P>
          To the maximum extent permitted by law, {COMPANY.legalName} and its
          officers, employees, and contractors will not be liable for any
          indirect, incidental, special, consequential, exemplary, or punitive
          damages, or for any loss of profits, revenue, data, or goodwill,
          arising out of or related to your use of the service. Our total
          liability for any claim arising out of or related to the service is
          limited to the greater of one hundred U.S. dollars or the amount you
          paid us in the twelve months before the claim arose.
        </P>
        <P>
          Some jurisdictions do not allow the exclusion or limitation of
          certain damages. In those jurisdictions, our liability is limited to
          the smallest extent permitted by law.
        </P>
      </Sec>

      <Sec n="15" title="Indemnification">
        <P>
          You agree to defend, indemnify, and hold harmless {COMPANY.legalName}{' '}
          and its officers, employees, and contractors from any claim, demand,
          loss, or expense, including reasonable attorneys&apos; fees, arising
          out of your use of the service, your Content, or your violation of
          these Terms or applicable law.
        </P>
      </Sec>

      <Sec n="16" title="Changes to the service or these Terms">
        <P>
          We may change the service. We may add features, remove features, or
          modify how features work. We may also update these Terms. If we make
          a material change, we will give reasonable notice, for example by
          email or by an in-product notice. The current version is always
          posted at{' '}
          <A href={`${COMPANY.productUrl}/legal/terms`}>
            {COMPANY.productUrl}/legal/terms
          </A>{' '}
          with the effective date. Continued use of the service after a change
          takes effect means you accept the change.
        </P>
      </Sec>

      <Sec n="17" title="Governing law and disputes">
        <P>
          These Terms are governed by the laws of {COMPANY.governingLaw},
          without regard to its conflict-of-laws rules. The state and federal
          courts located in {COMPANY.venue} have exclusive jurisdiction over
          any dispute arising out of or related to these Terms or the service,
          and you consent to personal jurisdiction in those courts.
        </P>
      </Sec>

      <Sec n="18" title="General">
        <P>
          These Terms, together with the policies referenced in them, are the
          entire agreement between you and {COMPANY.legalName} about the
          service. If a court finds any part of these Terms unenforceable, the
          rest remains in effect. Our failure to enforce a provision is not a
          waiver of it. You may not assign these Terms without our written
          consent. We may assign them in connection with a merger, acquisition,
          or sale of assets.
        </P>
      </Sec>

      <Sec n="19" title="Contact">
        <P>For questions about these Terms, write to us at:</P>
        <ContactBlock
          lines={[
            COMPANY.legalName,
            'Attn: Legal',
            COMPANY.address,
            COMPANY.emails.legal,
          ]}
        />
      </Sec>
    </>
  );
}

function PrivacyPolicy() {
  return (
    <>
      <P>
        This policy explains what {COMPANY.product} collects, why, and your
        rights over it. The short version: we collect what we need to run the
        service. We do not sell it. We do not use your Content to train AI
        models. We do not advertise to you. If something here is unclear,
        write to{' '}
        <A href={`mailto:${COMPANY.emails.privacy}`}>
          {COMPANY.emails.privacy}
        </A>
        .
      </P>

      <Sec n="1" title="Who we are">
        <P>
          {COMPANY.product} is operated by {COMPANY.legalName}, organized in
          {' '}{COMPANY.venue}. Our address is {COMPANY.address}.
          {COMPANY.legalName} is the data controller for the personal
          information described in this policy.
        </P>
      </Sec>

      <Sec n="2" title="What we collect">
        <Sub title="Account information">
          <P>
            Your email address, password (stored as a one-way hash), display
            name, optional profile image, and ORCID ID if you provide one. You
            give us this when you sign up or update your settings.
          </P>
        </Sub>
        <Sub title="Content you create">
          <P>
            Sources you upload (including PDFs), notes, highlights, tags,
            concepts, collections, and the relationships you draw between
            them. We refer to this collectively as your &ldquo;Content.&rdquo;
            You retain ownership of it.
          </P>
        </Sub>
        <Sub title="Payment information">
          <P>
            If you buy a Pack, Stripe processes the payment. We receive a
            record of the purchase, including amount, currency, the last four
            digits of your card, and Stripe&apos;s customer and charge
            identifiers. We do not receive or store full card numbers.
          </P>
        </Sub>
        <Sub title="Technical and usage information">
          <P>
            Your IP address, browser type, device type, operating system,
            pages visited, actions taken, and timestamps. We use this to
            operate the service, prevent abuse, and understand how the
            product is used in aggregate. Cookies and similar technologies
            are described in the <A href="/legal/cookies">Cookie Notice</A>.
          </P>
        </Sub>
        <Sub title="Information about people in academic literature">
          <P>
            The service stores information about authors and other people
            referenced in your research, including names, affiliations, and
            ORCID identifiers. Most of this is drawn from public sources,
            including the public ORCID registry. It is research data about
            third parties already part of the academic record. It is not
            information about you.
          </P>
        </Sub>
      </Sec>

      <Sec n="3" title="How we use it">
        <L
          items={[
            'Run the service: serve your Content, sync your devices, handle uploads, deliver search and other product features.',
            'Process AI features when you initiate them. The full treatment is in the AI Use and Content Policy.',
            'Process payments through Stripe.',
            'Send transactional email through SendGrid: receipts, password resets, share notifications, security alerts.',
            'Investigate suspected violations of our terms or applicable law, and protect the rights, property, and safety of our users and the service.',
            'Improve the product through internal analytics on aggregate, non-identifying usage. These analytics are for our use only.',
          ]}
        />
      </Sec>

      <Sec n="4" title="What we do not do">
        <L
          items={[
            'We do not sell your personal information.',
            'We do not share your personal information for cross-context behavioral advertising.',
            'We do not use your Content to train AI models, ours or anyone else’s. The AI providers we use process your Content under contracts that prohibit them from training on it.',
            'We do not currently use advertising trackers, ad pixels, or marketing analytics.',
          ]}
        />
        <Note>
          We may add product analytics (such as Google Analytics) or
          advertising pixels (such as the Meta or Google Ads pixels) in the
          future. If we do, we will update this policy first, name what we
          have added, and provide a way to opt out of non-essential tracking.
          This is a notice, not a quiet reservation of rights.
        </Note>
      </Sec>

      <Sec n="5" title="Who we share it with">
        <P>We share information only with:</P>
        <L
          items={[
            <>Service providers we use to run the product, including Stripe, Amazon Web Services, SendGrid, Anthropic, and the public ORCID registry. The current list is on our <A href="/legal/subprocessors">Subprocessors page</A>.</>,
            'Other users, when you choose to share Content with them. They see what you share, at the permission level you set, until you revoke access.',
            'Authorities, when required by valid legal process. We push back on overbroad requests.',
            'A successor entity, in connection with a merger, acquisition, or sale of assets. We will give notice before personal information becomes subject to a different privacy policy.',
          ]}
        />
      </Sec>

      <Sec n="6" title="Legal bases for processing (EU, UK, EEA, Switzerland)">
        <P>
          If you are in the EU, UK, EEA, or Switzerland, we process your
          personal information under the following legal bases:
        </P>
        <L
          items={[
            'Performance of a contract: to provide the service you signed up for.',
            'Legitimate interests: to operate, secure, and improve the service, and to prevent fraud and abuse. We balance these interests against your rights.',
            'Consent: where required, for example for optional communications. You may withdraw consent at any time.',
            'Legal obligation: where the law requires us to retain or disclose information.',
          ]}
        />
      </Sec>

      <Sec n="7" title="International transfers">
        <P>
          The service is operated from the United States. If you use the
          service from outside the United States, your information is
          transferred to and processed in the United States. Where the law
          requires it, we rely on Standard Contractual Clauses or equivalent
          safeguards with our service providers.
        </P>
      </Sec>

      <Sec n="8" title="Retention">
        <P>
          We keep your account and Content for as long as your account is
          active. You can delete your account from your settings page. After
          deletion, we delete or anonymize your personal information within
          90 days, except where we are required to keep it longer. Examples
          of longer retention include transaction records for tax purposes,
          information involved in an unresolved dispute, and information
          required by law to be preserved. Backups are overwritten on a
          rolling schedule.
        </P>
      </Sec>

      <Sec n="9" title="Your rights">
        <P>Depending on where you live, you may have the right to:</P>
        <L
          items={[
            'Access the personal information we hold about you.',
            'Correct inaccurate information.',
            'Delete your information.',
            'Receive a portable copy of your information.',
            'Object to or restrict certain processing.',
            'Withdraw consent where we relied on it.',
            'Not be discriminated against for exercising these rights.',
          ]}
        />
        <Sub title="If you are in California">
          <P>
            The rights above are provided under the California Consumer
            Privacy Act and California Privacy Rights Act. We do not sell
            personal information. We have not sold or shared personal
            information for cross-context behavioral advertising in the past
            twelve months. You may designate an authorized agent to make a
            request on your behalf.
          </P>
        </Sub>
        <Sub title="If you are in the EU, UK, EEA, or Switzerland">
          <P>
            The rights above are provided under the GDPR and equivalent laws.
            You also have the right to lodge a complaint with your local
            supervisory authority.
          </P>
        </Sub>
        <P>
          To exercise any of these rights, write to{' '}
          <A href={`mailto:${COMPANY.emails.privacy}`}>
            {COMPANY.emails.privacy}
          </A>
          . We will respond within the time required by law. We may need to
          verify your identity before acting on a request.
        </P>
      </Sec>

      <Sec n="10" title="Children">
        <P>
          The service is not for children under 16. We do not knowingly
          collect personal information from children under 16. If you
          believe a child has provided us with personal information, write
          to{' '}
          <A href={`mailto:${COMPANY.emails.privacy}`}>
            {COMPANY.emails.privacy}
          </A>{' '}
          and we will delete it.
        </P>
      </Sec>

      <Sec n="11" title="Security">
        <P>
          We protect accounts, Content, and payments with measures
          appropriate to the sensitivity of the data, including encryption
          in transit and at rest, hashed passwords, role-based access for
          our staff, and audit logging. The details are in the{' '}
          <A href="/legal/security">Security Overview</A>. No system is
          perfectly secure. If you suspect unauthorized access to your
          account, write to{' '}
          <A href={`mailto:${COMPANY.emails.security}`}>
            {COMPANY.emails.security}
          </A>{' '}
          immediately.
        </P>
      </Sec>

      <Sec n="12" title="Changes to this policy">
        <P>
          We will update this policy when our practices change. The current
          version is always posted at{' '}
          <A href={`${COMPANY.productUrl}/legal/privacy`}>
            {COMPANY.productUrl}/legal/privacy
          </A>{' '}
          with the effective date. For material changes, we will give
          reasonable notice, for example through an in-product notice or an
          email to the address on your account.
        </P>
      </Sec>

      <Sec n="13" title="Contact">
        <P>For privacy questions, write to us at:</P>
        <ContactBlock
          lines={[
            COMPANY.legalName,
            'Attn: Privacy',
            COMPANY.address,
            COMPANY.emails.privacy,
          ]}
        />
      </Sec>
    </>
  );
}

function CookieNotice() {
  return (
    <>
      <P>
        Cookies are small files that websites store on your device.
        {' '}{COMPANY.product} uses them sparingly. This notice explains what
        we set, why, and what you can do about it.
      </P>
      <P>
        We do not use advertising cookies or third-party analytics today. If
        that changes, we will list them here first.
      </P>

      <Sec n="1" title="What we use today">
        <Sub title="Strictly necessary">
          <P>
            These cookies are required for the service to function. You
            cannot opt out of them while using the service. They are set by
            us, on our own domain, and are not shared with third parties.
          </P>
          <L
            items={[
              'Session cookie. Keeps you signed in as you move between pages. Deleted when you sign out or when the session expires.',
              'CSRF token. Protects forms and actions from cross-site request forgery.',
              'Remember-me token. Set only if you check the option to stay signed in. Lets you stay signed in across browser restarts.',
            ]}
          />
        </Sub>
      </Sec>

      <Sec n="2" title="What we do not use today">
        <L
          items={[
            'Advertising cookies, ad pixels, or marketing trackers.',
            'Third-party analytics cookies (for example, Google Analytics).',
            'Cross-site behavioral tracking of any kind.',
          ]}
        />
        <Note>
          We may add product analytics or advertising pixels in the future
          (for example, Google Analytics or the Meta and Google Ads pixels).
          If we do, we will update this notice with the names of the
          providers, what they collect, and how to opt out. We will also
          update the <A href="/legal/privacy">Privacy Policy</A> at the same
          time.
        </Note>
      </Sec>

      <Sec n="3" title="Third parties on the service">
        <P>
          When you make a purchase, we hand you off to Stripe to enter
          payment details. Stripe sets its own cookies on its pages and uses
          them for fraud prevention and to operate its checkout. Those
          cookies are governed by Stripe&apos;s privacy and cookie policies,
          not ours. We do not receive Stripe&apos;s cookies, and Stripe
          does not receive ours.
        </P>
      </Sec>

      <Sec n="4" title="Your choices">
        <P>
          Most browsers let you block or delete cookies through their
          settings. Blocking strictly necessary cookies will sign you out and
          may prevent core features from working. Some features that depend
          on staying signed in across page loads will not function without
          them.
        </P>
        <P>
          If we add optional cookies in the future, we will provide a way to
          decline them without losing access to core features. Until then,
          there is nothing optional to opt out of on our domain.
        </P>
      </Sec>

      <Sec n="5" title="Do Not Track and Global Privacy Control">
        <P>
          Browsers send signals like Do Not Track and Global Privacy Control
          to indicate a preference about tracking. Because we do not engage
          in cross-context behavioral advertising or third-party tracking
          today, these signals do not currently change our behavior. If we
          add tracking that the signals address, we will honor them.
        </P>
      </Sec>

      <Sec n="6" title="Changes to this notice">
        <P>
          The current version is always at{' '}
          <A href={`${COMPANY.productUrl}/legal/cookies`}>
            {COMPANY.productUrl}/legal/cookies
          </A>{' '}
          with the effective date. We will give reasonable notice of
          material changes, especially before adding cookies that fall
          outside the strictly necessary category.
        </P>
      </Sec>

      <Sec n="7" title="Contact">
        <P>
          Questions about this notice go to{' '}
          <A href={`mailto:${COMPANY.emails.privacy}`}>
            {COMPANY.emails.privacy}
          </A>
          .
        </P>
      </Sec>
    </>
  );
}

function AcceptableUsePolicy() {
  return (
    <>
      <P>
        This policy describes what you may and may not do on{' '}
        {COMPANY.product}. It applies to everyone who uses the service,
        including invited collaborators and people who view shared
        collections. Violations can result in suspension or termination of
        your account. The full agreement is in the{' '}
        <A href="/legal/terms">Terms of Service</A>; this document is
        incorporated into those Terms.
      </P>

      <Sec n="1" title="Content you may not upload">
        <P>You may not upload, store, or share content that:</P>
        <L
          items={[
            'Is illegal under applicable law, or that promotes or facilitates illegal activity.',
            'You do not have the right to upload, including content that infringes copyright, trademark, trade secret, or other intellectual property rights. Reports of infringement are handled under the Copyright and DMCA Policy.',
            'Sexually exploits or endangers minors. We report such content to the National Center for Missing and Exploited Children and to appropriate authorities. There is no exception to this.',
            'Contains malware, exploits, or other code designed to compromise systems, accounts, or data.',
            'Discloses personal information about others without authority to do so, including doxing, non-consensual intimate imagery, or unauthorized disclosure of confidential records.',
            'Threatens, harasses, or incites violence against a person or a group.',
            'Is fraudulent, deceptive, or designed to impersonate another person or organization.',
          ]}
        />
        <P>
          Research and clinical content that addresses sensitive topics is
          permitted. The line is the purpose: studying a topic is fine,
          using the service to harm a person or to evade the law is not.
        </P>
      </Sec>

      <Sec n="2" title="Behavior you may not engage in">
        <L
          items={[
            'Sharing your account, password, or session with another person, or letting another person use your account.',
            'Creating accounts by automated means, or operating fake or impersonator accounts.',
            'Scraping, crawling, or otherwise extracting data from the service except through interfaces we provide for that purpose.',
            'Reverse engineering, decompiling, or attempting to derive source code, except to the extent the law permits.',
            'Probing, scanning, or testing the security of the service except as allowed under our responsible disclosure terms below.',
            'Interfering with the service, the network, or other users, including denial-of-service attacks, rate-limit evasion, and abuse of free-tier resources.',
            'Using the service to send spam, unauthorized commercial communications, or unsolicited messages to other users.',
            'Misrepresenting your identity, your affiliation, or the source of content you upload.',
            'Using the service in violation of export controls, sanctions, or other laws.',
          ]}
        />
      </Sec>

      <Sec n="3" title="Sharing and redistribution">
        <P>
          When you share a collection, source, or other Content with another
          user, you authorize us to make it accessible to them at the
          permission level you choose. You are responsible for the rights
          you have to that Content and for sharing only what you are
          permitted to share.
        </P>
        <P>
          The service is not a redistribution platform. Do not use shares to
          distribute paywalled, licensed, or otherwise restricted material
          to people who do not have an independent right to access it.
          Sharing within a research group of properly licensed materials is
          generally fine; making a Pack of copyrighted PDFs available to
          the public is not.
        </P>
      </Sec>

      <Sec n="4" title="AI features">
        <P>
          {COMPANY.product} offers AI-assisted features such as concept
          extraction and metadata suggestion. When using these features:
        </P>
        <L
          items={[
            'Do not attempt to extract our prompts, instructions, or other internal configuration.',
            'Do not use the features to generate content that violates this policy.',
            'Do not attempt to access another user’s Content through AI features.',
            'Do not use outputs in ways that misrepresent them as something other than AI-assisted, where representation matters (for example, in academic submissions or peer review where disclosure is required).',
          ]}
        />
        <P>
          AI outputs can be wrong. You are responsible for verifying them
          before relying on them. The full treatment is in the{' '}
          <A href="/legal/ai">AI Use and Content Policy</A>.
        </P>
      </Sec>

      <Sec n="5" title="Security testing and responsible disclosure">
        <P>
          If you discover a vulnerability in the service, report it to{' '}
          <A href={`mailto:${COMPANY.emails.security}`}>
            {COMPANY.emails.security}
          </A>{' '}
          before disclosing it elsewhere. We will work with you in good
          faith. While you are testing in good faith and following this
          policy, we will not pursue legal action against you, and we will
          treat your access as authorized for the purpose of the test.
        </P>
        <P>Good-faith testing means:</P>
        <L
          items={[
            'You test only against accounts and data that belong to you.',
            'You stop and report as soon as you confirm a vulnerability.',
            'You do not exfiltrate, destroy, or modify data beyond the minimum needed to demonstrate the issue.',
            'You do not degrade the service for other users.',
            'You give us reasonable time to fix the issue before public disclosure.',
          ]}
        />
      </Sec>

      <Sec n="6" title="Reporting violations">
        <P>
          To report content or behavior that violates this policy, write to{' '}
          <A href={`mailto:${COMPANY.emails.abuse}`}>
            {COMPANY.emails.abuse}
          </A>
          . For copyright complaints specifically, follow the procedure in
          the <A href="/legal/dmca">Copyright and DMCA Policy</A>. We
          investigate reports made in good faith and take action where
          warranted.
        </P>
      </Sec>

      <Sec n="7" title="What happens when this policy is violated">
        <P>
          We take a graduated approach where the violation allows for one.
          Depending on the severity and the history, we may:
        </P>
        <L
          items={[
            'Remove or hide specific content.',
            'Restrict specific features.',
            'Suspend the account temporarily.',
            'Terminate the account, which ends access to the service and to any paid Packs associated with it.',
            'Cooperate with law enforcement, including responding to valid legal process.',
          ]}
        />
        <P>
          For severe violations, including the upload of content that
          sexually exploits minors, the response is immediate termination
          and reporting to authorities.
        </P>
        <P>
          Termination for cause does not entitle you to a refund of fees
          already paid. Refunds in other circumstances are governed by the{' '}
          <A href="/legal/refunds">Refund Policy</A>.
        </P>
      </Sec>

      <Sec n="8" title="Changes to this policy">
        <P>
          We will update this policy as new abuse patterns emerge or as the
          service changes. The current version is always at{' '}
          <A href={`${COMPANY.productUrl}/legal/acceptable-use`}>
            {COMPANY.productUrl}/legal/acceptable-use
          </A>{' '}
          with the effective date.
        </P>
      </Sec>

      <Sec n="9" title="Contact">
        <P>
          To report abuse, write to{' '}
          <A href={`mailto:${COMPANY.emails.abuse}`}>
            {COMPANY.emails.abuse}
          </A>
          . For questions about this policy, write to{' '}
          <A href={`mailto:${COMPANY.emails.legal}`}>
            {COMPANY.emails.legal}
          </A>
          .
        </P>
      </Sec>
    </>
  );
}

function DmcaPolicy() {
  return (
    <>
      <P>
        {COMPANY.legalName} respects the intellectual property rights of
        others and expects users of {COMPANY.product} to do the same. This
        policy describes how to report copyright infringement to us under
        the Digital Millennium Copyright Act (the &ldquo;DMCA&rdquo;) and
        what we do in response. It also explains how a user whose content
        has been removed can submit a counter-notice.
      </P>
      <P>
        We respond promptly to valid notices and we terminate the accounts
        of repeat infringers. Submitting a notice or counter-notice with
        material misrepresentations exposes you to liability under federal
        law. Read each section before you file.
      </P>

      <Sec n="1" title="Designated agent">
        <P>
          Notices of claimed copyright infringement must be sent to our
          designated agent at the address below. The agent is registered
          with the U.S. Copyright Office.
        </P>
        <ContactBlock
          lines={[
            COMPANY.legalName,
            'Attn: ' + COMPANY.dmcaAgent.title,
            COMPANY.dmcaAgent.name,
            COMPANY.dmcaAgent.address,
            'Email: ' + COMPANY.dmcaAgent.email,
            'Phone: ' + COMPANY.dmcaAgent.phone,
          ]}
        />
        <Note>
          Notices sent to anyone other than the designated agent above may
          be ignored. For the fastest response, use email.
        </Note>
      </Sec>

      <Sec n="2" title="How to file a notice of infringement">
        <P>
          To file a notice, send our designated agent a written
          communication that includes all of the following. The DMCA, at 17
          U.S.C. &sect; 512(c)(3), requires each item.
        </P>
        <L
          items={[
            'A physical or electronic signature of the owner, or of a person authorized to act on behalf of the owner, of the exclusive right that is allegedly infringed.',
            'Identification of the copyrighted work claimed to have been infringed. If multiple works on the service are covered by a single notice, a representative list of those works.',
            'Identification of the material that is claimed to be infringing and that is to be removed or access to which is to be disabled, with information reasonably sufficient to permit us to locate the material. URLs are best.',
            'Information reasonably sufficient to permit us to contact you, including your address, telephone number, and an email address.',
            'A statement that you have a good-faith belief that the use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.',
            'A statement, made under penalty of perjury, that the information in the notice is accurate, and that you are the copyright owner or are authorized to act on behalf of the owner.',
          ]}
        />
        <P>
          A notice that does not substantially comply with these requirements
          may not be effective under the DMCA. Section 512(f) imposes
          liability for any damages, including costs and attorneys&apos;
          fees, on a person who knowingly materially misrepresents that
          material is infringing.
        </P>
      </Sec>

      <Sec n="3" title="What we do when we receive a notice">
        <L
          items={[
            'We review the notice for compliance with the requirements above.',
            'If it substantially complies, we expeditiously remove or disable access to the material identified.',
            'We notify the user who uploaded the material that we have done so, and we provide them with a copy of the notice.',
            'We track the user’s history of complaints. Repeat infringers will have their accounts terminated, as described below.',
          ]}
        />
      </Sec>

      <Sec n="4" title="How to file a counter-notice">
        <P>
          If your material has been removed and you believe the removal was
          a mistake, or that you have the right to use the material, you may
          submit a counter-notice to our designated agent. The DMCA, at 17
          U.S.C. &sect; 512(g)(3), requires each of the following:
        </P>
        <L
          items={[
            'Your physical or electronic signature.',
            'Identification of the material that has been removed, and the location at which it appeared before it was removed.',
            'A statement, made under penalty of perjury, that you have a good-faith belief that the material was removed or disabled as a result of mistake or misidentification.',
            'Your name, address, and telephone number.',
            'A statement that you consent to the jurisdiction of the federal district court for the judicial district in which your address is located, or, if your address is outside of the United States, the judicial district in which we may be found, and that you will accept service of process from the person who filed the original notice or that person’s agent.',
          ]}
        />
        <P>
          If we receive a valid counter-notice, we will forward it to the
          original complainant and tell them that we will restore the
          material in 10 to 14 business days. We will restore the material
          unless the complainant files an action seeking a court order
          against you within that window.
        </P>
        <P>
          Section 512(f) imposes liability for material misrepresentations
          in a counter-notice as well. Do not submit a counter-notice unless
          you have a good-faith belief in its contents.
        </P>
      </Sec>

      <Sec n="5" title="Repeat infringer policy">
        <P>
          We terminate the accounts of users who are repeat infringers in
          appropriate circumstances. We consider the totality of the user&apos;s
          history, including the number of valid notices, the user&apos;s
          response, whether counter-notices were filed and were valid, and
          whether the conduct continued after warning. Termination ends
          access to the service and to any paid Packs associated with the
          account, and does not entitle the user to a refund.
        </P>
      </Sec>

      <Sec n="6" title="Trademark and other complaints">
        <P>
          For trademark, right-of-publicity, or other non-copyright
          intellectual-property complaints, write to{' '}
          <A href={`mailto:${COMPANY.emails.legal}`}>
            {COMPANY.emails.legal}
          </A>
          . Identify the right at issue, the material that allegedly
          infringes it, and your authority to act, with the same level of
          specificity required of a DMCA notice. We do not have a separate
          statutory takedown framework for these claims, and we evaluate
          them case by case.
        </P>
      </Sec>

      <Sec n="7" title="Notices outside the United States">
        <P>
          If you are outside the United States and your jurisdiction has
          its own takedown framework (for example, the EU Digital Services
          Act or the UK Online Safety Act), you may use that framework where
          it applies. We respond to valid takedown notices under those
          frameworks where they apply to us. The contact above accepts
          notices in any case.
        </P>
      </Sec>

      <Sec n="8" title="Changes to this policy">
        <P>
          The current version is always at{' '}
          <A href={`${COMPANY.productUrl}/legal/dmca`}>
            {COMPANY.productUrl}/legal/dmca
          </A>{' '}
          with the effective date. We will update the designated-agent
          block above to match the registration on file with the U.S.
          Copyright Office at all times.
        </P>
      </Sec>
    </>
  );
}

function RefundPolicy() {
  return (
    <>
      <P>
        This policy explains when {COMPANY.product} issues refunds and how
        to request one. The short version: you can get a full refund within
        7 days of purchase if you have not yet accessed substantive Pack
        content. Beyond that, refunds are at our discretion, with a small
        set of cases where we always issue one.
      </P>
      <P>
        Refunds apply to purchases made directly through {COMPANY.product}.
        Purchases made through a third party (for example, a reseller) are
        governed by that party&apos;s policy.
      </P>

      <Sec n="1" title="The 7-day window">
        <P>
          You may request a full refund within 7 days of purchase, for any
          reason, if you have not yet accessed substantive content from the
          Pack. &ldquo;Substantive content&rdquo; means opening more than
          the preview, downloading included sources, or otherwise using
          material that was not visible before purchase. Browsing the
          Pack&apos;s landing page or its preview does not count.
        </P>
        <P>
          We err on the side of granting these requests when the use is
          ambiguous. If you ask within the window and your usage is light,
          assume the answer is yes.
        </P>
      </Sec>

      <Sec n="2" title="Cases where we always refund">
        <P>
          Regardless of the 7-day window, we issue a full refund in the
          following cases:
        </P>
        <L
          items={[
            'Duplicate purchase. You bought the same Pack twice. Send us either order ID and we refund the second.',
            'Billing error. You were charged the wrong amount, or charged after a successful cancellation, or charged for something you did not buy.',
            'Unauthorized purchase. The transaction was made without your consent, including fraud on your card. Report it to us and to your card issuer.',
            'Material failure. The Pack does not contain what was advertised, or technical issues on our end prevent you from accessing it and we cannot resolve them in a reasonable time.',
          ]}
        />
        <P>
          These are not subject to the 7-day limit. Write to us whenever
          you discover the issue.
        </P>
      </Sec>

      <Sec n="3" title="Outside the 7-day window">
        <P>
          After 7 days, or if you have already used substantive Pack
          content, refunds are at our discretion. Tell us what happened. We
          consider how much of the Pack has been used, how recent the
          purchase was, and whether the situation is exceptional. We do not
          guarantee a refund in these cases, and we will tell you yes or no
          plainly.
        </P>
      </Sec>

      <Sec n="4" title="Subscriptions">
        <P>
          {COMPANY.product} does not offer subscription plans at this time.
          If we add them, this section will describe the refund terms that
          apply to them, including any cancellation, proration, and
          auto-renewal rules required by California law and other
          jurisdictions where we operate.
        </P>
      </Sec>

      <Sec n="5" title="How to request a refund">
        <P>
          Email{' '}
          <A href={`mailto:${COMPANY.emails.contact}`}>
            {COMPANY.emails.contact}
          </A>{' '}
          from the address on your account. Include:
        </P>
        <L
          items={[
            'The order or receipt ID, if you have it. Otherwise the date and the approximate amount.',
            'The reason for the request. A short sentence is enough.',
          ]}
        />
        <P>
          We respond within 3 business days. Most refund decisions take
          less than 24 hours.
        </P>
      </Sec>

      <Sec n="6" title="How refunds are processed">
        <P>
          Approved refunds go back to the original payment method through
          Stripe. Processing on our side is immediate. The funds typically
          appear on your statement within 5 to 10 business days, depending
          on your card issuer or bank. We cannot speed up the issuer&apos;s
          side.
        </P>
        <P>
          When a Pack is refunded, your access to that Pack ends. Notes
          and other Content you created while you had access remain in
          your account.
        </P>
      </Sec>

      <Sec n="7" title="Chargebacks">
        <P>
          If something is wrong with a charge, write to us before disputing
          it with your card issuer. Most issues we can resolve faster than
          a chargeback can. Disputes filed without first contacting us, or
          filed in bad faith, may result in suspension or termination of
          your account.
        </P>
      </Sec>

      <Sec n="8" title="Termination for cause">
        <P>
          If your account is suspended or terminated because of a violation
          of the <A href="/legal/terms">Terms of Service</A> or the{' '}
          <A href="/legal/acceptable-use">Acceptable Use Policy</A>, you
          are not entitled to a refund of fees already paid for Packs or
          other access. This is the only category of termination that
          forfeits refund eligibility.
        </P>
      </Sec>

      <Sec n="9" title="Changes to this policy">
        <P>
          The current version is always at{' '}
          <A href={`${COMPANY.productUrl}/legal/refunds`}>
            {COMPANY.productUrl}/legal/refunds
          </A>{' '}
          with the effective date. Changes apply to purchases made after
          the change takes effect.
        </P>
      </Sec>

      <Sec n="10" title="Contact">
        <P>
          For refund requests and questions about this policy, write to{' '}
          <A href={`mailto:${COMPANY.emails.contact}`}>
            {COMPANY.emails.contact}
          </A>
          .
        </P>
      </Sec>
    </>
  );
}

function AiPolicy() {
  return (
    <>
      <P>
        Some {COMPANY.product} features use a large language model to read
        your Content and produce structured output. This document explains
        which features, what gets sent, what we do not do with your
        Content, and what you should expect from the output.
      </P>
      <P>
        The short version: we send only what a feature requires, the
        provider does not train on it, and you should treat AI output the
        way you would treat a research assistant&apos;s draft. Useful, but
        verify before you cite.
      </P>

      <Sec n="1" title="What counts as an AI feature">
        <P>
          AI features are the parts of the service that pass your Content
          through a language model to extract, classify, or suggest
          something. As of the date above, these include:
        </P>
        <L
          items={[
            'Metadata extraction from PDFs and other source files (title, authors, year, abstract, and similar fields).',
            'Concept suggestion from a source’s abstract or full text.',
            'Concept-type classification, which decides whether a suggested concept is a methodology, construct, finding, or other category.',
            'Author and entity disambiguation, where the same name across multiple sources may refer to different people.',
            'Curated Pack generation, where editors use AI assistance to draft Pack content. Pack content is reviewed by a human before publication.',
          ]}
        />
        <P>
          Features that do not pass your Content to a language model are
          not AI features under this policy, even if they involve
          automation. Search, sorting, and rule-based imports are
          examples of non-AI features.
        </P>
      </Sec>

      <Sec n="2" title="Who processes AI requests">
        <P>
          We use Anthropic as our AI provider today. When you trigger an
          AI feature, the relevant portion of your Content is sent to
          Anthropic&apos;s API for processing, the model produces output,
          and that output is returned to {COMPANY.product}. We do not pass
          your Content to any other AI provider. The current and complete
          list of subprocessors is on the{' '}
          <A href="/legal/subprocessors">Subprocessors page</A>.
        </P>
      </Sec>

      <Sec n="3" title="What gets sent">
        <P>
          We send the minimum the feature needs. Different features need
          different inputs:
        </P>
        <L
          items={[
            'Metadata extraction sends a portion of the source file (typically the first pages or the extracted text), plus a prompt that tells the model what fields to return.',
            'Concept suggestion sends an abstract or selected text, plus a prompt that tells the model what to surface.',
            'Concept-type classification sends a concept name and a small amount of context.',
            'Author disambiguation sends author strings and the surrounding citation context.',
          ]}
        />
        <P>
          We do not send your account credentials, your payment
          information, or Content from other users. We do not bundle your
          Content with other users&apos; Content in a single request.
        </P>
      </Sec>

      <Sec n="4" title="What does not happen with your Content">
        <L
          items={[
            'Anthropic does not use API inputs or outputs to train its models. This is a contractual commitment under Anthropic’s Commercial Terms of Service for API customers.',
            'We do not use your Content to train models, ours or anyone else’s.',
            'We do not sell your Content. We do not share it for advertising. We do not build profiles of you across services.',
            'We do not let other users see the AI output generated from your Content unless you choose to share it.',
          ]}
        />
      </Sec>

      <Sec n="5" title="Retention by the AI provider">
        <P>
          Anthropic retains API requests and responses for a limited period
          for abuse and safety monitoring, then deletes them according to
          its standard retention schedule. We do not control that schedule.
          The current terms are published at{' '}
          <A href="https://www.anthropic.com/legal/commercial-terms">
            anthropic.com/legal/commercial-terms
          </A>{' '}
          and{' '}
          <A href="https://privacy.anthropic.com">privacy.anthropic.com</A>.
          We rely on those terms; we update this policy if our reliance
          changes.
        </P>
        <P>
          On our side, we store the AI output that becomes part of your
          Content (for example, an extracted abstract that fills in a
          source&apos;s metadata). We do not separately log the prompt and
          response of every AI call.
        </P>
      </Sec>

      <Sec n="6" title="Outputs can be wrong">
        <P>
          Language models produce confident text whether or not it is
          correct. AI output on this service can be wrong about facts,
          inferences, citations, and identifiers. We design features to
          surface the source of an extraction (for example, the page in a
          PDF) so you can verify before you rely on it. Verification is
          your responsibility.
        </P>
        <P>
          Treat AI output the way you would treat a draft from a research
          assistant who has not finished training. Useful as a starting
          point. Not a citation.
        </P>
      </Sec>

      <Sec n="7" title="Your responsibilities">
        <L
          items={[
            'Verify AI output before you act on it, especially for citations, author identities, and quantitative claims.',
            'Do not pass AI output off as something other than AI-assisted in contexts where disclosure is required, including journal submissions, peer review, theses, and grant applications. Many publishers and institutions now require disclosure; that is between you and them, but the use of this service does not exempt you.',
            'Do not use AI features to violate the Acceptable Use Policy.',
            'Do not upload Content you are not permitted to upload, including Content covered by confidentiality, embargo, or human-subjects restrictions that prohibit transmission to a third-party AI provider.',
          ]}
        />
      </Sec>

      <Sec n="8" title="A note on confidential and sensitive Content">
        <P>
          If your work involves Content that you are contractually or
          ethically prohibited from sending to a third-party AI provider,
          do not run AI features over that Content. Examples include
          unpublished manuscripts under peer review, IRB-restricted
          interview transcripts, signed-NDA materials, and patient-level
          clinical data. Non-AI features remain available for that
          Content; you can store, search, tag, annotate, and share it
          without invoking an AI feature.
        </P>
      </Sec>

      <Sec n="9" title="Future changes">
        <P>
          We may add AI providers, change models, or add new AI features.
          When we do:
        </P>
        <L
          items={[
            'A new provider will appear on the Subprocessors page, with notice.',
            'A new feature will be documented here, with a description of what it sends and what it returns.',
            'A change to the no-training commitment, if it ever happened, would be flagged prominently. We do not anticipate this.',
          ]}
        />
      </Sec>

      <Sec n="10" title="Opting out">
        <P>
          AI features are invoked when you trigger them, not in the
          background. You can decline to use them; the rest of the service
          works without them. Some features, such as automatic metadata
          extraction during upload, run by default. You can disable
          automatic AI processing in your settings or skip the relevant
          step in the upload wizard.
        </P>
        <P>
          If we add AI features that run continuously (rather than on
          trigger), we will notify you before turning them on and provide
          a way to keep them off.
        </P>
      </Sec>

      <Sec n="11" title="Fair use of paid tiers">
        <P>
          The Unlimited plan is designed for individual researchers,
          clinicians, and writers with heavy ongoing use. It is not
          designed for automated traffic, programmatic batch generation,
          shared or resold access, or volume that an individual person
          could not plausibly read and review. The same principle applies
          to mini-AI features on the Storage and Unlimited plans.
        </P>
        <P>
          We may contact accounts whose concept-definition generation
          volume exceeds about one hundred requests in a calendar month,
          or whose mini-AI usage shows automation patterns, to confirm
          the account is being used by one person for personal research.
          Where use appears automated, shared across multiple people, or
          otherwise outside the spirit of an individual subscription, we
          may rate-limit, pause, or end the AI features on that account.
          We give reasonable notice before any restriction takes effect
          and refund the unused portion of any prepaid period if we end
          your access early. None of this affects your stored Content or
          your ability to read, search, and export it.
        </P>
        <P>
          If you have a legitimate higher-volume need — a teaching cohort,
          a research group, an institution — write to{' '}
          <A href={`mailto:${COMPANY.emails.contact}`}>
            {COMPANY.emails.contact}
          </A>{' '}
          before scaling up.  We can usually accommodate it; we cannot
          accommodate it after the fact.
        </P>
      </Sec>

      <Sec n="12" title="Changes to this policy">
        <P>
          The current version is always at{' '}
          <A href={`${COMPANY.productUrl}/legal/ai`}>
            {COMPANY.productUrl}/legal/ai
          </A>{' '}
          with the effective date. We will give reasonable notice of
          material changes, particularly changes to who processes your
          Content or how it is retained.
        </P>
      </Sec>

      <Sec n="13" title="Contact">
        <P>
          For questions about AI features and how your Content is
          processed, write to{' '}
          <A href={`mailto:${COMPANY.emails.privacy}`}>
            {COMPANY.emails.privacy}
          </A>
          .
        </P>
      </Sec>
    </>
  );
}

function Subprocessors() {
  return (
    <>
      <P>
        A subprocessor is a third party we use to operate {COMPANY.product}.
        This page lists every subprocessor that receives or stores Content
        or personal information on our behalf, what they do, what they
        receive, and where they operate. We update this page when the list
        changes and notify users of material additions in advance.
      </P>

      <Sec n="1" title="Current subprocessors">
        <SubprocessorCard
          name="Amazon Web Services"
          url="https://aws.amazon.com"
          role="Hosting and storage. The application servers, databases, and uploaded files run on AWS."
          data="All Content and personal information stored by the service: account records, sources (including PDFs), notes, highlights, tags, concepts, collections, and operational logs."
          location="United States (primary regions)"
          links={[
            { label: 'Privacy Notice', href: 'https://aws.amazon.com/privacy/' },
            { label: 'GDPR / DPA', href: 'https://aws.amazon.com/compliance/gdpr-center/' },
          ]}
        />

        <SubprocessorCard
          name="Stripe"
          url="https://stripe.com"
          role="Payments. Processes Pack purchases, handles cards, and manages payouts."
          data="Name, email, billing address, payment-method details (card information goes directly to Stripe; we do not see full card numbers), purchase history, and IP at checkout."
          location="United States, with regional processing where applicable"
          links={[
            { label: 'Privacy Policy', href: 'https://stripe.com/privacy' },
            { label: 'DPA', href: 'https://stripe.com/legal/dpa' },
          ]}
        />

        <SubprocessorCard
          name="Twilio SendGrid"
          url="https://sendgrid.com"
          role="Transactional email. Sends receipts, password resets, share notifications, and security alerts."
          data="Email address, display name, the contents of the messages we send to you, and delivery and engagement metadata (delivered, bounced, opened)."
          location="United States"
          links={[
            { label: 'Privacy Notice', href: 'https://www.twilio.com/legal/privacy' },
            { label: 'DPA', href: 'https://www.twilio.com/legal/data-protection-addendum' },
          ]}
        />

        <SubprocessorCard
          name="Anthropic"
          url="https://www.anthropic.com"
          role="AI features. Processes inputs from features such as metadata extraction, concept suggestion, and concept-type classification. See the AI Use and Content Policy for what is sent on a per-feature basis."
          data="The portion of your Content required for the feature you trigger, plus the prompt that frames the request. Account credentials, payment information, and other users’ Content are not sent."
          location="United States"
          links={[
            { label: 'Privacy Policy', href: 'https://privacy.anthropic.com' },
            { label: 'Commercial Terms (no-training commitment)', href: 'https://www.anthropic.com/legal/commercial-terms' },
          ]}
        />
      </Sec>

      <Sec n="2" title="External sources we read">
        <P>
          The following are public services that we query on your behalf,
          but we do not send your personal information or Content to them.
          We list them here for transparency.
        </P>
        <SubprocessorCard
          name="ORCID public registry"
          url="https://orcid.org"
          role="Author enrichment. We query the public ORCID registry to resolve author identifiers and pull publicly available author metadata for People records."
          data="One-way: we read public ORCID data. We do not send user-identifying information to ORCID. Search queries are constructed from public author strings."
          location="ORCID is a non-profit headquartered in the United States, with global operations."
          links={[
            { label: 'Privacy Policy', href: 'https://info.orcid.org/privacy-policy/' },
          ]}
        />
      </Sec>

      <Sec n="3" title="Subprocessors we may add">
        <P>
          We do not currently use product analytics or advertising
          subprocessors. If we add them, the candidates we are most likely
          to use are:
        </P>
        <L
          items={[
            'Google Analytics or a comparable product analytics service, for aggregate usage measurement.',
            'Meta and Google Ads pixels, if we run advertising campaigns and need conversion measurement.',
          ]}
        />
        <P>
          We will update this page before turning any of these on. The{' '}
          <A href="/legal/privacy">Privacy Policy</A> and{' '}
          <A href="/legal/cookies">Cookie Notice</A> will be updated at the
          same time.
        </P>
      </Sec>

      <Sec n="4" title="How we choose and oversee subprocessors">
        <L
          items={[
            'We use as few as the service requires.',
            'We require a written data-processing agreement, where personal information is involved, that obligates the subprocessor to security, confidentiality, and use only as we direct.',
            'We rely on each subprocessor’s public terms for retention and security baselines, and we do not use providers whose terms are inconsistent with this policy or our Privacy Policy.',
            'For AI providers specifically, we require a contractual commitment that inputs and outputs will not be used to train the provider’s models.',
          ]}
        />
      </Sec>

      <Sec n="5" title="Notification of changes">
        <P>
          The current list above is the canonical list. For material
          changes, we will give notice in the product or by email at least
          30 days before the change takes effect, except where a faster
          change is necessary for security or legal reasons. The current
          version is always at{' '}
          <A href={`${COMPANY.productUrl}/legal/subprocessors`}>
            {COMPANY.productUrl}/legal/subprocessors
          </A>{' '}
          with the effective date.
        </P>
      </Sec>

      <Sec n="6" title="Contact">
        <P>
          For questions about subprocessors, write to{' '}
          <A href={`mailto:${COMPANY.emails.privacy}`}>
            {COMPANY.emails.privacy}
          </A>
          .
        </P>
      </Sec>
    </>
  );
}

function SubprocessorCard({ name, url, role, data, location, links }) {
  return (
    <div style={primStyles.subprocessorCard}>
      <div style={primStyles.subprocessorHeader}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={primStyles.subprocessorName}
        >
          {name}
        </a>
      </div>
      <SubprocessorField label="Role" value={role} />
      <SubprocessorField label="Data received" value={data} />
      <SubprocessorField label="Location" value={location} />
      {links && links.length > 0 && (
        <div style={primStyles.subprocessorLinksRow}>
          {links.map((l, i) => (
            <a
              key={i}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              style={primStyles.subprocessorLink}
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function SubprocessorField({ label, value }) {
  return (
    <div style={primStyles.subprocessorField}>
      <span style={primStyles.subprocessorLabel}>{label}</span>
      <span style={primStyles.subprocessorValue}>{value}</span>
    </div>
  );
}

function AccessibilityStatement() {
  return (
    <>
      <P>
        {COMPANY.product} is built for serious research, and accessibility
        is part of that. This statement describes the standard we aim for,
        where we currently meet it, where we do not, and how to report a
        problem so we can fix it.
      </P>
      <P>
        We try to be straight with you. The product is at an early stage,
        and we have not completed a third-party accessibility audit. The
        sections below describe our actual posture, not a promise.
      </P>

      <Sec n="1" title="The standard we aim for">
        <P>
          We aim to meet the Web Content Accessibility Guidelines (WCAG)
          2.1 at Level AA, with a track toward WCAG 2.2 AA as we
          remediate. WCAG is the international standard most accessibility
          regulations cite, including Section 508 in the United States and
          EN 301 549 in the European Union.
        </P>
      </Sec>

      <Sec n="2" title="Where we currently do well">
        <L
          items={[
            'Pages render correctly without JavaScript blocked content for the primary reading flow on legal, marketing, and authentication pages.',
            'Color contrast on text follows our design tokens, which were chosen with WCAG AA contrast targets in mind.',
            'Forms have visible labels, focus states, and validation messages that are announced by screen readers.',
            'The site works with keyboard navigation across the primary reading and editing flows.',
            'Body text uses readable sizes and line lengths, with system-level zoom support up to 200 percent.',
          ]}
        />
      </Sec>

      <Sec n="3" title="Where we are weaker">
        <P>We know about the following gaps:</P>
        <L
          items={[
            'The connection visualization is a graph rendered with a canvas. Screen readers cannot describe the graph the way they describe text. We are working on a tabular alternative view of the same data.',
            'The PDF study mode uses a third-party PDF renderer. PDF accessibility depends substantially on the source document. We are working on better text-mode reading and structured navigation, but PDFs that lack OCR or proper structure will remain difficult.',
            'The bulk upload wizard relies on drag-and-drop. A keyboard-only fallback exists but is less discoverable than the drag interaction.',
            'Some admin tooling has not been reviewed for screen-reader compatibility, because admin tooling is used by us and not by end users. If you are an admin user with accessibility needs, write to us and we will prioritize the surface you depend on.',
          ]}
        />
      </Sec>

      <Sec n="4" title="How to report an accessibility issue">
        <P>
          If something does not work for you, write to{' '}
          <A href={`mailto:${COMPANY.emails.accessibility}`}>
            {COMPANY.emails.accessibility}
          </A>{' '}
          and tell us:
        </P>
        <L
          items={[
            'What you were trying to do.',
            'What happened, or what did not happen.',
            'Your assistive technology, if you use one (for example, screen reader and version, voice control, switch device).',
            'Your browser and operating system.',
          ]}
        />
        <P>
          A short message is enough. We will reply within 5 business days
          and tell you whether the issue is something we can fix soon,
          something on a longer track, or something we cannot fix and why.
        </P>
      </Sec>

      <Sec n="5" title="Accommodations on request">
        <P>
          If a feature is blocking you and we cannot resolve it in time,
          tell us what you need. We will work with you to provide the
          underlying information in a different format where we can. This
          might mean exporting your Content as plain text or CSV, providing
          a transcript of an interactive view, or walking you through a
          flow over email or a call.
        </P>
      </Sec>

      <Sec n="6" title="Third-party content">
        <P>
          Some Content on the service is uploaded by users and is outside
          our control, including PDFs of academic papers. The accessibility
          of those documents depends on how they were produced. We do not
          modify uploaded documents; we render them. Where we control the
          rendering, we work to make navigation and text extraction as
          accessible as we can.
        </P>
      </Sec>

      <Sec n="7" title="Changes to this statement">
        <P>
          The current version is always at{' '}
          <A href={`${COMPANY.productUrl}/legal/accessibility`}>
            {COMPANY.productUrl}/legal/accessibility
          </A>{' '}
          with the effective date. As we close known gaps, we will update
          the &ldquo;where we are weaker&rdquo; section above. As we
          identify new ones, we will add them.
        </P>
      </Sec>

      <Sec n="8" title="Contact">
        <P>
          For accessibility questions, reports, or accommodations, write
          to{' '}
          <A href={`mailto:${COMPANY.emails.accessibility}`}>
            {COMPANY.emails.accessibility}
          </A>
          .
        </P>
      </Sec>
    </>
  );
}

function SecurityOverview() {
  return (
    <>
      <P>
        This page describes how we protect accounts, Content, and payments
        on {COMPANY.product}. It covers what is in place today, what is
        not, and what you can do on your end. We try to be specific.
        Generic security claims are easy to write and not useful to read.
      </P>

      <Sec n="1" title="Data in transit">
        <P>
          All connections between your browser and {COMPANY.product} are
          encrypted with TLS. Connections from {COMPANY.product} to our
          subprocessors (AWS, Stripe, SendGrid, Anthropic, ORCID) are also
          encrypted in transit. We do not accept unencrypted connections
          to the application.
        </P>
      </Sec>

      <Sec n="2" title="Data at rest">
        <P>
          Application data is stored in services managed by Amazon Web
          Services. Databases and uploaded files are encrypted at rest
          using AWS-managed encryption (AES-256). Backups inherit the
          same encryption.
        </P>
      </Sec>

      <Sec n="3" title="Account security">
        <L
          items={[
            'Passwords are stored as one-way bcrypt hashes. We cannot read your password, even if we wanted to. The reset flow generates a single-use token rather than emailing the password back.',
            'Sessions expire after a period of inactivity, and signing out invalidates the session.',
            'Password reset tokens are single-use, time-limited, and tied to the email address on file.',
            'We log authentication events (sign-in, sign-out, password changes) and use them to investigate suspected unauthorized access.',
          ]}
        />
        <Note>
          Multi-factor authentication is not yet available. It is on the
          roadmap. Until then, the most effective thing you can do for
          your account is use a unique, strong password from a password
          manager.
        </Note>
      </Sec>

      <Sec n="4" title="Application security">
        <L
          items={[
            'CSRF tokens protect every state-changing request.',
            'Output is escaped by default to prevent cross-site scripting in user-generated content.',
            'Database queries use parameterized statements to prevent SQL injection.',
            'Sensitive parameters (passwords, tokens) are filtered out of application logs.',
            'Rate limits are applied to authentication and other sensitive endpoints to slow brute-force attempts.',
          ]}
        />
      </Sec>

      <Sec n="5" title="Payments">
        <P>
          Card details are entered directly into a Stripe-hosted form and
          do not transit our servers. We receive only a token and a small
          set of non-sensitive purchase metadata (amount, currency,
          last four digits, customer ID). Stripe is PCI DSS certified;
          our scope is reduced accordingly.
        </P>
      </Sec>

      <Sec n="6" title="Infrastructure">
        <L
          items={[
            'Production runs on AWS in U.S. regions. Application servers, databases, object storage, and caches are isolated within a virtual private cloud, with public exposure limited to the load balancer and a small set of necessary endpoints.',
            'Access to production by our team is limited to people whose role requires it, uses unique credentials, and is logged.',
            'Security patches for our dependencies are applied on a regular cadence, with critical patches expedited.',
          ]}
        />
      </Sec>

      <Sec n="7" title="Backups">
        <P>
          Databases are backed up automatically through AWS-managed
          backups, retained for a rolling window, and encrypted at rest.
          Object storage is backed by S3&apos;s durability guarantees.
          When you delete your account, backups are overwritten on a
          rolling schedule as described in the{' '}
          <A href="/legal/privacy">Privacy Policy</A>.
        </P>
      </Sec>

      <Sec n="8" title="Logging and monitoring">
        <P>
          We log application and infrastructure events to investigate
          incidents and operate the service. Logs include timestamps,
          identifiers for the requesting account, and metadata about the
          request, but exclude passwords, tokens, and the contents of
          most user payloads. Logs are retained for the time required for
          troubleshooting and security review, then expire.
        </P>
      </Sec>

      <Sec n="9" title="Subprocessor security">
        <P>
          We rely on the security posture of our subprocessors for the
          parts of the service they operate. Each subprocessor and the
          relevant terms are listed on the{' '}
          <A href="/legal/subprocessors">Subprocessors page</A>. AWS,
          Stripe, and Twilio SendGrid hold third-party security
          attestations that we rely on (SOC 2, ISO 27001, PCI DSS, where
          applicable).
        </P>
      </Sec>

      <Sec n="10" title="What we do not yet have">
        <L
          items={[
            'Multi-factor authentication for user accounts. On the roadmap.',
            'A SOC 2 Type II report or equivalent third-party security audit. We follow the controls a small SaaS would adopt for one, but we have not been audited.',
            'A formal penetration-test report. We have not commissioned one yet.',
            'A bug bounty program. We honor good-faith vulnerability reports under our responsible-disclosure terms; we do not pay bounties at this time.',
          ]}
        />
      </Sec>

      <Sec n="11" title="Incident response">
        <P>
          If we discover or are notified of a security incident affecting
          our users, we investigate immediately, contain the issue,
          assess impact, and remediate. Where the law requires
          notification, or where notification is the right thing to do
          regardless of law, we will notify affected users without undue
          delay and include:
        </P>
        <L
          items={[
            'What happened, in plain language.',
            'What information was or may have been involved.',
            'What we have done in response.',
            'What you can do to protect yourself.',
          ]}
        />
        <P>
          We do not minimize incidents in user communications. We tell
          you what we know, what we do not know, and when we expect to
          know more.
        </P>
      </Sec>

      <Sec n="12" title="Reporting a vulnerability">
        <P>
          If you find a security issue, write to{' '}
          <A href={`mailto:${COMPANY.emails.security}`}>
            {COMPANY.emails.security}
          </A>{' '}
          before disclosing it elsewhere. The full responsible-disclosure
          terms are in the{' '}
          <A href="/legal/acceptable-use">Acceptable Use Policy</A>. While
          you are testing in good faith and following those terms, we will
          not pursue legal action against you and we treat your access as
          authorized for the purpose of the test.
        </P>
      </Sec>

      <Sec n="13" title="What you can do">
        <L
          items={[
            'Use a unique, strong password. A password manager makes this easy.',
            'Sign out of shared or public devices.',
            'Treat password-reset and sign-in emails with care. We will never ask you for your password by email.',
            'Tell us promptly if you suspect unauthorized access. Email security@ from a different channel than the suspected compromise.',
          ]}
        />
      </Sec>

      <Sec n="14" title="Changes to this overview">
        <P>
          The current version is always at{' '}
          <A href={`${COMPANY.productUrl}/legal/security`}>
            {COMPANY.productUrl}/legal/security
          </A>{' '}
          with the effective date. We update this page as we add controls
          (for example, when we add multi-factor authentication or
          complete a third-party audit).
        </P>
      </Sec>

      <Sec n="15" title="Contact">
        <P>
          For security questions or to report an issue, write to{' '}
          <A href={`mailto:${COMPANY.emails.security}`}>
            {COMPANY.emails.security}
          </A>
          .
        </P>
      </Sec>
    </>
  );
}

// =====================================================================
// Styles
// =====================================================================

const pageStyles = {
  outer: {
    width: '100%',
    padding: '64px 24px 96px',
    background: 'var(--paper, #faf7f0)',
    minHeight: '60vh',
  },
  column: {
    maxWidth: '760px',
    margin: '0 auto',
    fontFamily: 'var(--font-body, "Source Sans 3", sans-serif)',
    color: 'var(--ink, #1a1813)',
  },
  backLink: {
    display: 'inline-block',
    marginBottom: 'var(--space-5, 20px)',
    fontSize: '13px',
    color: 'var(--ink-3, #6b6557)',
    textDecoration: 'none',
  },
  eyebrow: {
    fontFamily: 'var(--font-body, "Source Sans 3", sans-serif)',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: 'var(--ink-3, #6b6557)',
    marginBottom: 12,
  },
  title: {
    fontFamily: 'var(--font-display, "Source Serif 4", serif)',
    fontSize: '40px',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    lineHeight: 1.15,
    color: 'var(--ink, #1a1813)',
    margin: 0,
    marginBottom: 12,
  },
  indexTitle: {
    fontFamily: 'var(--font-display, "Source Serif 4", serif)',
    fontSize: '48px',
    fontWeight: 600,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    color: 'var(--ink, #1a1813)',
    margin: 0,
    marginBottom: 16,
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: '13px',
    color: 'var(--ink-3, #6b6557)',
    marginBottom: 32,
  },
  lede: {
    fontFamily: 'var(--font-body, "Source Sans 3", sans-serif)',
    fontSize: '17px',
    lineHeight: 1.7,
    color: 'var(--ink-2, #3a3528)',
    marginTop: 0,
    marginBottom: 24,
  },
  body: {
    fontSize: '16px',
    lineHeight: 1.75,
    color: 'var(--ink, #1a1813)',
  },
  docFooter: {
    marginTop: 48,
    paddingTop: 24,
    borderTop: '1px solid var(--ink-line, #d9d2c3)',
    fontSize: '13px',
    color: 'var(--ink-3, #6b6557)',
  },
  link: {
    color: 'var(--ink, #1a1813)',
    textDecoration: 'underline',
    textDecorationColor: 'var(--ink-3, #6b6557)',
    textUnderlineOffset: '2px',
  },
  draftPill: {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#7a5a14',
    background: '#fff4d6',
    border: '1px solid #e6c98a',
    borderRadius: 4,
  },
  indexList: {
    listStyle: 'none',
    padding: 0,
    margin: '32px 0 0',
    borderTop: '1px solid var(--ink-line, #d9d2c3)',
  },
  indexItem: {
    borderBottom: '1px solid var(--ink-line, #d9d2c3)',
  },
  indexLink: {
    display: 'block',
    padding: '20px 0',
    color: 'var(--ink, #1a1813)',
    textDecoration: 'none',
  },
  indexItemTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  indexItemTitle: {
    fontFamily: 'var(--font-display, "Source Serif 4", serif)',
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--ink, #1a1813)',
  },
  indexItemSummary: {
    fontSize: '14px',
    color: 'var(--ink-2, #3a3528)',
    lineHeight: 1.6,
    marginBottom: 6,
  },
  indexItemMeta: {
    fontSize: '12px',
    color: 'var(--ink-3, #6b6557)',
  },
};

const primStyles = {
  section: {
    marginBottom: 32,
  },
  h2: {
    display: 'flex',
    gap: 12,
    fontFamily: 'var(--font-display, "Source Serif 4", serif)',
    fontSize: '22px',
    fontWeight: 600,
    color: 'var(--ink, #1a1813)',
    margin: 0,
    marginBottom: 12,
    letterSpacing: '-0.005em',
  },
  h2Num: {
    color: 'var(--ink-3, #6b6557)',
    fontWeight: 500,
    minWidth: 28,
  },
  sub: {
    marginTop: 16,
    marginBottom: 16,
  },
  h3: {
    fontFamily: 'var(--font-body, "Source Sans 3", sans-serif)',
    fontSize: '15px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--ink-2, #3a3528)',
    margin: 0,
    marginBottom: 8,
  },
  p: {
    margin: 0,
    marginBottom: 14,
    fontSize: '16px',
    lineHeight: 1.75,
    color: 'var(--ink, #1a1813)',
  },
  ul: {
    margin: '0 0 14px',
    paddingLeft: '1.4em',
  },
  li: {
    fontSize: '16px',
    lineHeight: 1.75,
    color: 'var(--ink, #1a1813)',
    marginBottom: 6,
  },
  note: {
    padding: '14px 16px',
    background: 'var(--paper-2, #f3eee2)',
    borderLeft: '3px solid var(--ink-3, #6b6557)',
    borderRadius: 4,
    fontSize: '14px',
    lineHeight: 1.7,
    color: 'var(--ink-2, #3a3528)',
    marginBottom: 16,
  },
  draftBanner: {
    padding: '14px 16px',
    background: '#fff8e6',
    border: '1px solid #e6c98a',
    borderRadius: 6,
    fontSize: '14px',
    lineHeight: 1.65,
    color: '#5a4514',
    marginBottom: 32,
  },
  contact: {
    padding: '14px 16px',
    background: 'var(--paper-2, #f3eee2)',
    borderRadius: 4,
    fontSize: '14px',
    lineHeight: 1.7,
    color: 'var(--ink-2, #3a3528)',
    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
    marginBottom: 16,
  },
  subprocessorCard: {
    padding: '18px 20px',
    border: '1px solid var(--ink-line, #d9d2c3)',
    borderRadius: 6,
    background: 'var(--paper-2, #f3eee2)',
    marginBottom: 14,
  },
  subprocessorHeader: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottom: '1px solid var(--ink-line, #d9d2c3)',
  },
  subprocessorName: {
    fontFamily: 'var(--font-display, "Source Serif 4", serif)',
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--ink, #1a1813)',
    textDecoration: 'none',
    borderBottom: '1px dotted var(--ink-3, #6b6557)',
  },
  subprocessorField: {
    display: 'grid',
    gridTemplateColumns: '120px 1fr',
    gap: 12,
    fontSize: '14px',
    lineHeight: 1.65,
    marginBottom: 6,
  },
  subprocessorLabel: {
    fontWeight: 600,
    color: 'var(--ink-3, #6b6557)',
    textTransform: 'uppercase',
    fontSize: '11px',
    letterSpacing: '0.08em',
    paddingTop: 3,
  },
  subprocessorValue: {
    color: 'var(--ink, #1a1813)',
  },
  subprocessorLinksRow: {
    display: 'flex',
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTop: '1px solid var(--ink-line, #d9d2c3)',
    fontSize: '13px',
    flexWrap: 'wrap',
  },
  subprocessorLink: {
    color: 'var(--ink-2, #3a3528)',
    textDecoration: 'underline',
    textDecorationColor: 'var(--ink-3, #6b6557)',
    textUnderlineOffset: '2px',
  },
};
