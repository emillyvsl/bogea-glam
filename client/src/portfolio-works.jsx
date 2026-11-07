import React,{useState} from 'react';
const works=[
['tratamento','Tratamentos',2,'tratamento','Especialista em tratamentos capilares, com experiência em grandes marcas profissionais do mercado da beleza. Durante 3 anos, fui Embaixadora Kérastase Paris e também trabalhei com marcas como Wella, L’Oréal Professionnel, Joico e Senscience.'],
['mechas','Mechas & morena iluminada',4,'mechas','Minha assinatura nas mechas e na morena iluminada é um resultado sofisticado, natural e atemporal. Busco criar pontos de luz que se integrem ao cabelo de forma delicada, respeitando a base, a textura e a individualidade de cada cliente.'],
['escova','Escova',2,'escova','A escovação é personalizada de acordo com o resultado desejado: do liso polido ao movimento mais sofisticado. Minha especialidade é a escova modelada com efeito de ondas, criando volume, movimento e acabamento elegante, sem perder a naturalidade.'],
['maquiagem','Maquiagem',1,'maquiagem','A maquiagem é uma forma de traduzir diferentes versões de uma mesma beleza. Transito entre produções naturais e sofisticadas, maquiagens glamourosas e propostas editoriais, adaptando cada criação ao estilo, à ocasião e à personalidade da cliente. Meu propósito é valorizar a beleza individual e criar uma maquiagem que faça você se reconhecer em sua melhor versão.'],
['glam','Glam',3,'maquiagem','Uma maquiagem sofisticada e marcante, com acabamento impecável e produção pensada para quem deseja chegar e ser notada.'],
['basica','Básica',1,'maquiagem','Leve, elegante e natural. Realça os traços e valoriza a beleza sem pesar, perfeita para o dia a dia ou ocasiões especiais.'],
['fashion','Fashion',4,'maquiagem','Criatividade, conceito e personalidade. Maquiagens inspiradas no universo da moda, pensadas para editoriais, campanhas e produções autorais.'],
['noivas','Noivas',3,'maquiagem','Uma maquiagem sofisticada, confortável e de alta durabilidade, criada para acompanhar a noiva do primeiro registro ao último momento da celebração.'],
['sobrancelhas','Sobrancelhas',1,'sobrancelha','Realço a beleza natural do olhar através de um design personalizado, respeitando o formato do rosto, a estrutura dos fios e a identidade de cada cliente.']];
function MakeupPortfolio(){
  const [style,setStyle]=useState('glam');
  const intro=works.find(work=>work[0]==='maquiagem');
  const styles=works.filter(work=>['glam','basica','fashion'].includes(work[0]));
  const [key,title,count,,description]=styles.find(work=>work[0]===style);
  return <section className="makeup-showcase" id="maquiagem" aria-labelledby="makeup-title"><div className="makeup-intro"><p className="eyebrow">A ARTE DE REALÇAR VOCÊ</p><h2 id="makeup-title">Uma beleza.<br/><em>Diferentes versões de você.</em></h2><p>{intro[4]}</p></div><div className="makeup-style-picker" role="group" aria-label="Escolha o estilo de maquiagem">{styles.map(([id,name],i)=><button key={id} type="button" aria-pressed={style===id} onClick={()=>setStyle(id)}><span>0{i+1}</span><strong>{name}</strong><small>{id==='glam'?'Presença & sofisticação':id==='basica'?'Leveza & naturalidade':'Conceito & expressão'}</small></button>)}</div><div className="makeup-feature" key={key}><div className="makeup-feature-copy"><p className="eyebrow">MAQUIAGEM · {title.toUpperCase()}</p><h3>{title}</h3><p>{description}</p><a className="makeup-book" href="/servicos?busca=maquiagem#booking">Agendar maquiagem <span aria-hidden="true">↗</span></a></div><div className={`makeup-gallery makeup-photos-${count}`}>{Array.from({length:count},(_,i)=><img key={i} src={`/images/portfolio/${key}-${i+1}.webp`} alt={`Maquiagem ${title} por Vitória Bogéa — foto ${i+1}`} loading="lazy"/>)}</div></div><p className="makeup-signoff">Feita para a ocasião. <em>Pensada para você.</em></p></section>;
}
export default function PortfolioWorks() {
  return (
    <section className="portfolio-works" id="trabalhos">
      <header>
        <p className="eyebrow">BELEZA COM IDENTIDADE</p>

        <h2>
          Feito para realçar.
          <br />
          <em>Nunca para esconder.</em>
        </h2>

        <p>Conheça os trabalhos de Vitória Bogéa.</p>
      </header>

      {works.filter(work=>!['glam','basica','fashion'].includes(work[0])).map(([key, title, count, search, text], index) => key==='maquiagem'?<MakeupPortfolio key={key}/>:(
        <article
          className={`portfolio-work ${index % 2 ? 'reverse' : ''}`}
          key={key}
        >
          <div className="portfolio-work-copy">
            <h3>{title}</h3>
            <p>{text}</p>

            <a
              className="portfolio-work-book"
              href={`/servicos?busca=${encodeURIComponent(search)}`}
            >
              Agendar
            </a>
          </div>

          <div className={`portfolio-work-gallery photos-${count}`}>
            {Array.from({ length: count }, (_, i) => (
              <img
                key={`${key}-${i}`}
                src={`/images/portfolio/${key}-${i + 1}.webp`}
                alt={`${title} — trabalho de Vitória Bogéa ${i + 1}`}
                loading="lazy"
              />
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}



